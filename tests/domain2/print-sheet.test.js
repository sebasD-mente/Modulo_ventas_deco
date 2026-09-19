import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../server/config/prisma.js';
import {
  createPrintSheetSchema,
  assignItemsToSheetSchema,
  updateSheetStatusSchema,
} from '../../server/validators/printSheetValidators.js';
import {
  generateSheetCode,
  createPrintSheet,
  assignItemsToSheet,
  updateSheetStatus,
  getPrintSheets,
  getPrintSheetById,
} from '../../server/services/printSheetService.js';
import {
  listPrintSheets,
  getPrintSheet,
  createPrintSheet as createPrintSheetController,
  assignItems as assignItemsController,
  updateStatus as updateStatusController,
} from '../../server/controllers/printSheetController.js';

// Helper para simular req y res de Express
function createMockReqRes({
  body = {},
  query = {},
  params = {},
  headers = {},
  user = { id: 'usr-operario-01', role: 'OPERARIO_1' },
  tenantId = 'tenant-test-01',
} = {}) {
  const req = {
    body,
    query,
    params,
    headers,
    user,
    tenantId,
  };
  let responseData = null;
  let responseStatus = 200;
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(payload) {
      responseData = payload;
      return this;
    },
    get statusCode() {
      return responseStatus;
    },
    get body() {
      return responseData;
    },
  };
  return { req, res };
}

describe('Dominio 2 — Pliegos Diarios de Taller (PrintSheet)', () => {
  describe('1. Validadores Zod (printSheetValidators.js)', () => {
    it('createPrintSheetSchema debe aceptar materiales válidos', () => {
      const validMaterials = ['PVC_5MM', 'MDF_5_5MM', 'VINILO_SOLO', 'MIXTO'];
      for (const mat of validMaterials) {
        const result = createPrintSheetSchema.safeParse({ material: mat, notes: 'Nota de taller' });
        assert.equal(result.success, true, `Material ${mat} debería ser válido`);
      }
    });

    it('createPrintSheetSchema debe rechazar material no permitido', () => {
      const result = createPrintSheetSchema.safeParse({ material: 'CARTON_PIEDRA' });
      assert.equal(result.success, false);
      assert.ok(result.error.issues.some((i) => i.message.includes('Material debe ser')));
    });

    it('createPrintSheetSchema debe validar longitud máxima de notas (1000 chars)', () => {
      const longNotes = 'a'.repeat(1001);
      const result = createPrintSheetSchema.safeParse({ material: 'PVC_5MM', notes: longNotes });
      assert.equal(result.success, false);
    });

    it('assignItemsToSheetSchema debe requerir al menos un UUID de ítem válido', () => {
      const emptyResult = assignItemsToSheetSchema.safeParse({ saleItemIds: [] });
      assert.equal(emptyResult.success, false);

      const invalidUuid = assignItemsToSheetSchema.safeParse({ saleItemIds: ['not-a-uuid'] });
      assert.equal(invalidUuid.success, false);

      const validResult = assignItemsToSheetSchema.safeParse({
        saleItemIds: ['123e4567-e89b-12d3-a456-426614174000'],
      });
      assert.equal(validResult.success, true);
    });

    it('updateSheetStatusSchema debe validar los estados permitidos', () => {
      const validStatuses = ['ABIERTO', 'EN_PRODUCCION', 'IMPRESO', 'TERMINADO'];
      for (const st of validStatuses) {
        const result = updateSheetStatusSchema.safeParse({ status: st });
        assert.equal(result.success, true, `Estado ${st} debería ser válido`);
      }

      const invalidResult = updateSheetStatusSchema.safeParse({ status: 'CANCELADO' });
      assert.equal(invalidResult.success, false);
    });
  });

  describe('2. Generador de Consecutivo Diario y Creación de Pliego', () => {
    it('generateSheetCode debe generar PLI-YYYYMMDD-01 si no hay pliegos previos hoy', async () => {
      const mockTx = {
        printSheet: {
          findFirst: async () => null,
        },
      };
      const code = await generateSheetCode('tenant-1', mockTx);
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      assert.equal(code, `PLI-${todayStr}-01`);
    });

    it('generateSheetCode debe incrementar el correlativo al siguiente número', async () => {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const mockTx = {
        printSheet: {
          findFirst: async () => ({ sheetCode: `PLI-${todayStr}-04` }),
        },
      };
      const code = await generateSheetCode('tenant-1', mockTx);
      assert.equal(code, `PLI-${todayStr}-05`);
    });

    it('createPrintSheet debe ejecutar directamente el servicio y crear el pliego en estado ABIERTO', async () => {
      const originalTx = prisma.$transaction;
      try {
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const mockTx = {
          printSheet: {
            findFirst: async () => ({ sheetCode: `PLI-${todayStr}-01` }),
            create: async ({ data }) => ({
              id: 'sheet-new-1',
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const created = await createPrintSheet({
          tenantId: 'tenant-1',
          userId: 'usr-operario-1',
          material: 'PVC_5MM',
          notes: 'Primer pliego del día',
        });

        assert.equal(created.id, 'sheet-new-1');
        assert.equal(created.sheetCode, `PLI-${todayStr}-02`);
        assert.equal(created.status, 'ABIERTO');
        assert.equal(created.material, 'PVC_5MM');
        assert.equal(created.createdById, 'usr-operario-1');
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  describe('3. Freno Inquebrantable de Taller (Workshop Brake) — Ejecución Real del Servicio', () => {
    it('debe rechazar con HTTP 404 si el pliego no existe', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => null,
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await assignItemsToSheet({
              tenantId: 'tenant-1',
              sheetId: 'sheet-non-existent',
              saleItemIds: ['item-1'],
              userId: 'user-1',
            });
          },
          (err) => {
            assert.equal(err.statusCode, 404);
            assert.match(err.message, /Pliego de impresión no encontrado/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe rechazar con HTTP 400 si el pliego está en estado IMPRESO o TERMINADO', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-1',
              tenantId: 'tenant-1',
              status: 'IMPRESO',
            }),
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await assignItemsToSheet({
              tenantId: 'tenant-1',
              sheetId: 'sheet-1',
              saleItemIds: ['item-1'],
              userId: 'user-1',
            });
          },
          (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /No se pueden asignar ítems a un pliego con estado 'IMPRESO'/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe rechazar con HTTP 404 si uno de los ítems no existe o es de otro tenant', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => ({ id: 'sheet-1', tenantId: 'tenant-1', status: 'ABIERTO' }),
          },
          saleItem: {
            findMany: async () => [], // Ninguno encontrado
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await assignItemsToSheet({
              tenantId: 'tenant-1',
              sheetId: 'sheet-1',
              saleItemIds: ['item-missing'],
              userId: 'user-1',
            });
          },
          (err) => {
            assert.equal(err.statusCode, 404);
            assert.match(err.message, /Uno o más ítems no fueron encontrados/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe rechazar con HTTP 422 si la orden asociada está ANULADA ejecutando assignItemsToSheet', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-1',
              tenantId: 'tenant-1',
              status: 'ABIERTO',
              sheetCode: 'PLI-20260919-01',
            }),
          },
          saleItem: {
            findMany: async () => [
              {
                id: 'item-1',
                description: 'Cuadro Anime Cancelado',
                sale: {
                  tenantId: 'tenant-1',
                  saleNumber: 'VENT-1001',
                  status: 'ANULADA',
                  paymentStatus: 'PAGADO_TOTAL',
                },
              },
            ],
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await assignItemsToSheet({
              tenantId: 'tenant-1',
              sheetId: 'sheet-1',
              saleItemIds: ['item-1'],
              userId: 'user-1',
            });
          },
          (err) => {
            assert.equal(err.statusCode, 422);
            assert.match(err.message, /pertenece a una orden anulada \(#VENT-1001\)/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe rechazar con HTTP 422 si la orden asociada tiene paymentStatus PENDIENTE_ANTICIPO', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-1',
              tenantId: 'tenant-1',
              status: 'ABIERTO',
              sheetCode: 'PLI-20260919-01',
            }),
          },
          saleItem: {
            findMany: async () => [
              {
                id: 'item-2',
                description: 'Póster Van Gogh',
                sale: {
                  tenantId: 'tenant-1',
                  saleNumber: 'VENT-1002',
                  status: 'COMPLETADA',
                  paymentStatus: 'PENDIENTE_ANTICIPO',
                },
              },
            ],
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await assignItemsToSheet({
              tenantId: 'tenant-1',
              sheetId: 'sheet-1',
              saleItemIds: ['item-2'],
              userId: 'user-1',
            });
          },
          (err) => {
            assert.equal(err.statusCode, 422);
            assert.match(err.message, /está bloqueado: Orden #VENT-1002 no cuenta con anticipo registrado/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe rechazar con HTTP 422 si la orden asociada tiene un paymentStatus desconocido/inválido', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-1',
              tenantId: 'tenant-1',
              status: 'ABIERTO',
              sheetCode: 'PLI-20260919-01',
            }),
          },
          saleItem: {
            findMany: async () => [
              {
                id: 'item-inv',
                description: 'Póster Inválido',
                sale: {
                  tenantId: 'tenant-1',
                  saleNumber: 'VENT-9999',
                  status: 'COMPLETADA',
                  paymentStatus: 'ESTADO_DESCONOCIDO',
                },
              },
            ],
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await assignItemsToSheet({
              tenantId: 'tenant-1',
              sheetId: 'sheet-1',
              saleItemIds: ['item-inv'],
              userId: 'user-1',
            });
          },
          (err) => {
            assert.equal(err.statusCode, 422);
            assert.match(err.message, /no cuenta con anticipo válido/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe asignar exitosamente ítems con ANTICIPO_PAGADO o PAGADO_TOTAL y generar logs', async () => {
      const originalTx = prisma.$transaction;
      try {
        const updatedItems = [];
        const createdLogs = [];

        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-1',
              tenantId: 'tenant-1',
              status: 'ABIERTO',
              sheetCode: 'PLI-20260919-01',
            }),
            findUnique: async () => ({
              id: 'sheet-1',
              sheetCode: 'PLI-20260919-01',
              status: 'ABIERTO',
              items: [
                { id: 'item-1', productionStatus: 'A_PRODUCCION' },
                { id: 'item-2', productionStatus: 'A_PRODUCCION' },
              ],
            }),
          },
          saleItem: {
            findMany: async () => [
              {
                id: 'item-1',
                description: 'Obra Anticipo',
                productionStatus: 'EN_ESPERA',
                sale: { tenantId: 'tenant-1', saleNumber: 'VENT-2001', status: 'COMPLETADA', paymentStatus: 'ANTICIPO_PAGADO' },
              },
              {
                id: 'item-2',
                description: 'Obra Pagada',
                productionStatus: 'EN_ESPERA',
                sale: { tenantId: 'tenant-1', saleNumber: 'VENT-2002', status: 'COMPLETADA', paymentStatus: 'PAGADO_TOTAL' },
              },
            ],
            update: async ({ where, data }) => {
              updatedItems.push({ id: where.id, ...data });
              return { id: where.id, ...data };
            },
          },
          productionLog: {
            create: async ({ data }) => {
              createdLogs.push(data);
              return { id: 'log-' + createdLogs.length, ...data };
            },
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const result = await assignItemsToSheet({
          tenantId: 'tenant-1',
          sheetId: 'sheet-1',
          saleItemIds: ['item-1', 'item-2'],
          userId: 'usr-operario-01',
        });

        assert.equal(result.id, 'sheet-1');
        assert.equal(updatedItems.length, 2);
        assert.equal(updatedItems[0].printSheetId, 'sheet-1');
        assert.equal(updatedItems[0].productionStatus, 'A_PRODUCCION');
        assert.equal(updatedItems[1].printSheetId, 'sheet-1');
        assert.equal(updatedItems[1].productionStatus, 'A_PRODUCCION');

        assert.equal(createdLogs.length, 2);
        assert.equal(createdLogs[0].newStatus, 'A_PRODUCCION');
        assert.equal(createdLogs[0].userId, 'usr-operario-01');
        assert.match(createdLogs[0].notes, /Asignado a pliego PLI-20260919-01/);
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  describe('4. Cascada de Estado a IMPRESO — Ejecución Real del Servicio updateSheetStatus', () => {
    it('debe rechazar con HTTP 404 si el pliego no existe', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => null,
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        await assert.rejects(
          async () => {
            await updateSheetStatus({
              tenantId: 'tenant-1',
              sheetId: 'sheet-missing',
              status: 'EN_PRODUCCION',
              userId: 'user-1',
            });
          },
          (err) => {
            assert.equal(err.statusCode, 404);
            assert.match(err.message, /Pliego de impresión no encontrado/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('debe rechazar con HTTP 400 si la transición de estado es inválida', async () => {
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-1',
              tenantId: 'tenant-1',
              status: 'IMPRESO',
            }),
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        // IMPRESO no puede regresar a ABIERTO o EN_PRODUCCION
        await assert.rejects(
          async () => {
            await updateSheetStatus({
              tenantId: 'tenant-1',
              sheetId: 'sheet-1',
              status: 'ABIERTO',
              userId: 'user-1',
            });
          },
          (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /Transición de estado no válida de IMPRESO a ABIERTO/);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('al marcar IMPRESO debe ejecutar el servicio real, actualizar ítems asociados y generar productionLogs', async () => {
      const originalTx = prisma.$transaction;
      try {
        let updateSheetData = null;
        let updateManyItemsData = null;
        const createdLogs = [];

        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-123',
              tenantId: 'tenant-1',
              status: 'EN_PRODUCCION',
              sheetCode: 'PLI-20260919-01',
              notes: 'Notas previas',
            }),
            update: async ({ where, data }) => {
              updateSheetData = data;
              return {
                id: where.id,
                ...data,
                items: [
                  { id: 'item-1', productionStatus: 'IMPRESO' },
                  { id: 'item-2', productionStatus: 'IMPRESO' },
                ],
              };
            },
          },
          saleItem: {
            findMany: async () => [
              { id: 'item-1', productionStatus: 'A_PRODUCCION' },
              { id: 'item-2', productionStatus: 'A_PRODUCCION' },
            ],
            updateMany: async ({ where, data }) => {
              updateManyItemsData = { where, data };
              return { count: 2 };
            },
          },
          productionLog: {
            create: async ({ data }) => {
              createdLogs.push(data);
              return { id: 'log-' + createdLogs.length, ...data };
            },
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const result = await updateSheetStatus({
          tenantId: 'tenant-1',
          sheetId: 'sheet-123',
          status: 'IMPRESO',
          userId: 'usr-operario-02',
          notes: 'Impresión completada en taller',
        });

        assert.equal(result.id, 'sheet-123');
        assert.equal(result.status, 'IMPRESO');

        // Verificamos mutación en el pliego
        assert.ok(updateSheetData);
        assert.equal(updateSheetData.status, 'IMPRESO');
        assert.equal(updateSheetData.printedById, 'usr-operario-02');
        assert.ok(updateSheetData.printedAt instanceof Date);

        // Verificamos mutación en cascada en los saleItems del pliego
        assert.ok(updateManyItemsData);
        assert.equal(updateManyItemsData.where.printSheetId, 'sheet-123');
        assert.equal(updateManyItemsData.data.productionStatus, 'IMPRESO');
        assert.equal(updateManyItemsData.data.impresoById, 'usr-operario-02');
        assert.ok(updateManyItemsData.data.impresoAt instanceof Date);

        // Verificamos logs de auditoría generados por cada ítem
        assert.equal(createdLogs.length, 2);
        assert.equal(createdLogs[0].saleItemId, 'item-1');
        assert.equal(createdLogs[0].previousStatus, 'A_PRODUCCION');
        assert.equal(createdLogs[0].newStatus, 'IMPRESO');
        assert.equal(createdLogs[0].userId, 'usr-operario-02');
        assert.match(createdLogs[0].notes, /Pliego PLI-20260919-01 marcado como IMPRESO/);

        assert.equal(createdLogs[1].saleItemId, 'item-2');
        assert.equal(createdLogs[1].newStatus, 'IMPRESO');
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('transición de IMPRESO a TERMINADO debe actualizar estado sin re-ejecutar cascada de impresión', async () => {
      const originalTx = prisma.$transaction;
      try {
        let updateSheetData = null;
        let updateManyCalled = false;

        const mockTx = {
          printSheet: {
            findFirst: async () => ({
              id: 'sheet-123',
              tenantId: 'tenant-1',
              status: 'IMPRESO',
              sheetCode: 'PLI-20260919-01',
              notes: 'Ya impreso',
            }),
            update: async ({ where, data }) => {
              updateSheetData = data;
              return { id: where.id, ...data, items: [] };
            },
          },
          saleItem: {
            updateMany: async () => {
              updateManyCalled = true;
            },
          },
        };

        prisma.$transaction = async (cb) => cb(mockTx);

        const result = await updateSheetStatus({
          tenantId: 'tenant-1',
          sheetId: 'sheet-123',
          status: 'TERMINADO',
          userId: 'usr-operario-01',
        });

        assert.equal(result.status, 'TERMINADO');
        assert.equal(updateSheetData.status, 'TERMINADO');
        assert.equal(updateManyCalled, false, 'No debe re-ejecutar updateMany cuando no es IMPRESO');
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  describe('5. Servicios de Consulta (getPrintSheets y getPrintSheetById)', () => {
    it('getPrintSheets debe retornar paginación y lista de pliegos', async () => {
      const originalPrintSheet = prisma.printSheet;
      try {
        prisma.printSheet = {
          ...originalPrintSheet,
          count: async () => 2,
          findMany: async () => [
            { id: 'sheet-1', sheetCode: 'PLI-20260919-01', status: 'ABIERTO', _count: { items: 3 } },
            { id: 'sheet-2', sheetCode: 'PLI-20260919-02', status: 'IMPRESO', _count: { items: 5 } },
          ],
        };

        const result = await getPrintSheets({
          tenantId: 'tenant-1',
          status: 'ABIERTO',
          material: 'PVC_5MM',
          page: 1,
          limit: 10,
        });

        assert.equal(result.total, 2);
        assert.equal(result.page, 1);
        assert.equal(result.limit, 10);
        assert.equal(result.sheets.length, 2);
        assert.equal(result.hasNext, false);
      } finally {
        prisma.printSheet = originalPrintSheet;
      }
    });

    it('getPrintSheetById debe retornar detalle con obras o lanzar 404 si no existe', async () => {
      const originalPrintSheet = prisma.printSheet;
      try {
        prisma.printSheet = {
          ...originalPrintSheet,
          findFirst: async ({ where }) => {
            if (where.id === 'sheet-existing') {
              return {
                id: 'sheet-existing',
                sheetCode: 'PLI-20260919-01',
                items: [{ id: 'item-1', description: 'Obra 1' }],
              };
            }
            return null;
          },
        };

        const found = await getPrintSheetById({ tenantId: 'tenant-1', sheetId: 'sheet-existing' });
        assert.equal(found.id, 'sheet-existing');
        assert.equal(found.items.length, 1);

        await assert.rejects(
          async () => {
            await getPrintSheetById({ tenantId: 'tenant-1', sheetId: 'sheet-404' });
          },
          (err) => {
            assert.equal(err.statusCode, 404);
            assert.match(err.message, /Pliego de impresión no encontrado/);
            return true;
          }
        );
      } finally {
        prisma.printSheet = originalPrintSheet;
      }
    });
  });

  describe('6. Controlador printSheetController — Error Mapping & HTTP Codes', () => {
    it('listPrintSheets: responde 400 si falta tenantId, 200 en éxito, y 500 en error no manejado', async () => {
      // 1. Falta tenantId
      const { req: reqNoTenant, res: resNoTenant } = createMockReqRes({ tenantId: null });
      await listPrintSheets(reqNoTenant, resNoTenant);
      assert.equal(resNoTenant.statusCode, 400);
      assert.equal(resNoTenant.body.success, false);

      // 2. Éxito
      const originalPrintSheet = prisma.printSheet;
      try {
        prisma.printSheet = {
          ...originalPrintSheet,
          count: async () => 1,
          findMany: async () => [{ id: 'sheet-1', sheetCode: 'PLI-20260919-01', _count: { items: 1 } }],
        };
        const { req: reqOk, res: resOk } = createMockReqRes({ query: { status: 'ABIERTO' } });
        await listPrintSheets(reqOk, resOk);
        assert.equal(resOk.statusCode, 200);
        assert.equal(resOk.body.success, true);
        assert.equal(resOk.body.data.length, 1);
        assert.equal(resOk.body.pagination.total, 1);
      } finally {
        prisma.printSheet = originalPrintSheet;
      }

      // 3. Error no manejado -> 500
      const originalPrintSheetForErr = prisma.printSheet;
      try {
        prisma.printSheet = {
          ...originalPrintSheetForErr,
          count: async () => {
            throw new Error('Database connection failure');
          },
          findMany: async () => {
            throw new Error('Database connection failure');
          },
        };
        const { req: reqErr, res: resErr } = createMockReqRes();
        await listPrintSheets(reqErr, resErr);
        assert.equal(resErr.statusCode, 500);
        assert.equal(resErr.body.success, false);
      } finally {
        prisma.printSheet = originalPrintSheetForErr;
      }
    });

    it('getPrintSheet: responde 400 sin tenantId, 200 si existe, 404 si no existe, y 500 en fallo inesperado', async () => {
      // 1. Sin tenantId
      const { req: reqNoTenant, res: resNoTenant } = createMockReqRes({ tenantId: null });
      await getPrintSheet(reqNoTenant, resNoTenant);
      assert.equal(resNoTenant.statusCode, 400);

      // 2. 404 No encontrado
      const originalPrintSheet = prisma.printSheet;
      try {
        prisma.printSheet = {
          ...originalPrintSheet,
          findFirst: async () => null,
        };
        const { req: req404, res: res404 } = createMockReqRes({ params: { id: 'sheet-missing' } });
        await getPrintSheet(req404, res404);
        assert.equal(res404.statusCode, 404);
        assert.equal(res404.body.success, false);
      } finally {
        prisma.printSheet = originalPrintSheet;
      }

      // 3. 200 Éxito
      try {
        prisma.printSheet = {
          ...originalPrintSheet,
          findFirst: async () => ({ id: 'sheet-1', sheetCode: 'PLI-20260919-01', items: [] }),
        };
        const { req: reqOk, res: resOk } = createMockReqRes({ params: { id: 'sheet-1' } });
        await getPrintSheet(reqOk, resOk);
        assert.equal(resOk.statusCode, 200);
        assert.equal(resOk.body.success, true);
        assert.equal(resOk.body.data.id, 'sheet-1');
      } finally {
        prisma.printSheet = originalPrintSheet;
      }

      // 4. 500 Error no manejado (sin statusCode)
      try {
        prisma.printSheet = {
          ...originalPrintSheet,
          findFirst: async () => {
            throw new Error('Timeout crítico en lectura de base de datos');
          },
        };
        const { req: req500, res: res500 } = createMockReqRes({ params: { id: 'sheet-timeout' } });
        await getPrintSheet(req500, res500);
        assert.equal(res500.statusCode, 500);
        assert.equal(res500.body.success, false);
      } finally {
        prisma.printSheet = originalPrintSheet;
      }
    });

    it('createPrintSheetController: responde 201 en éxito, 400 sin tenantId, y 500 en fallo inesperado', async () => {
      // 1. Sin tenantId
      const { req: reqNoTenant, res: resNoTenant } = createMockReqRes({ tenantId: null });
      await createPrintSheetController(reqNoTenant, resNoTenant);
      assert.equal(resNoTenant.statusCode, 400);

      // 2. 201 Éxito
      const originalTx = prisma.$transaction;
      try {
        const mockTx = {
          printSheet: {
            findFirst: async () => null,
            create: async ({ data }) => ({ id: 'new-sheet-1', ...data }),
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx);

        const { req: reqCreate, res: resCreate } = createMockReqRes({
          body: { material: 'PVC_5MM', notes: 'Prueba controller' },
        });
        await createPrintSheetController(reqCreate, resCreate);
        assert.equal(resCreate.statusCode, 201);
        assert.equal(resCreate.body.success, true);
        assert.equal(resCreate.body.data.id, 'new-sheet-1');
      } finally {
        prisma.$transaction = originalTx;
      }

      // 3. 500 Error inesperado
      try {
        prisma.$transaction = async () => {
          throw new Error('Fallo de conexión en inserción');
        };
        const { req: reqErr, res: resErr } = createMockReqRes({
          body: { material: 'PVC_5MM' },
        });
        await createPrintSheetController(reqErr, resErr);
        assert.equal(resErr.statusCode, 500);
        assert.equal(resErr.body.success, false);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('assignItemsController: preserva HTTP 422 para Workshop Brake y HTTP 500 para fallos no manejados', async () => {
      // 1. Sin tenantId
      const { req: reqNoTenant, res: resNoTenant } = createMockReqRes({ tenantId: null });
      await assignItemsController(reqNoTenant, resNoTenant);
      assert.equal(resNoTenant.statusCode, 400);

      const originalTx = prisma.$transaction;
      try {
        // 2. Freno de Taller -> Retorna 422
        const mockTx422 = {
          printSheet: {
            findFirst: async () => ({ id: 'sheet-1', tenantId: 'tenant-test-01', status: 'ABIERTO' }),
          },
          saleItem: {
            findMany: async () => [
              {
                id: 'item-1',
                description: 'Obra Pendiente Anticipo',
                sale: {
                  tenantId: 'tenant-test-01',
                  saleNumber: 'VENT-5001',
                  status: 'COMPLETADA',
                  paymentStatus: 'PENDIENTE_ANTICIPO',
                },
              },
            ],
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx422);

        const { req: req422, res: res422 } = createMockReqRes({
          params: { id: 'sheet-1' },
          body: { saleItemIds: ['item-1'] },
        });
        await assignItemsController(req422, res422);
        assert.equal(res422.statusCode, 422);
        assert.equal(res422.body.success, false);
        assert.match(res422.body.error, /está bloqueado: Orden #VENT-5001 no cuenta con anticipo registrado/);

        // 3. Fallo inesperado de infraestructura (sin statusCode) -> Retorna 500
        prisma.$transaction = async () => {
          throw new Error('Fatal socket failure');
        };
        const { req: req500, res: res500 } = createMockReqRes({
          params: { id: 'sheet-1' },
          body: { saleItemIds: ['item-1'] },
        });
        await assignItemsController(req500, res500);
        assert.equal(res500.statusCode, 500);
        assert.equal(res500.body.success, false);
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('updateStatusController: preserva HTTP 400 en transición inválida y HTTP 500 en fallo inesperado', async () => {
      // 1. Sin tenantId
      const { req: reqNoTenant, res: resNoTenant } = createMockReqRes({ tenantId: null });
      await updateStatusController(reqNoTenant, resNoTenant);
      assert.equal(resNoTenant.statusCode, 400);

      const originalTx = prisma.$transaction;
      try {
        // 2. Transición inválida -> HTTP 400
        const mockTx400 = {
          printSheet: {
            findFirst: async () => ({ id: 'sheet-1', tenantId: 'tenant-test-01', status: 'IMPRESO' }),
          },
        };
        prisma.$transaction = async (cb) => cb(mockTx400);

        const { req: req400, res: res400 } = createMockReqRes({
          params: { id: 'sheet-1' },
          body: { status: 'ABIERTO' },
        });
        await updateStatusController(req400, res400);
        assert.equal(res400.statusCode, 400);
        assert.equal(res400.body.success, false);
        assert.match(res400.body.error, /Transición de estado no válida/);

        // 3. Fallo inesperado sin statusCode -> HTTP 500
        prisma.$transaction = async () => {
          throw new Error('Error inesperado de motor transaccional');
        };
        const { req: req500, res: res500 } = createMockReqRes({
          params: { id: 'sheet-1' },
          body: { status: 'TERMINADO' },
        });
        await updateStatusController(req500, res500);
        assert.equal(res500.statusCode, 500);
        assert.equal(res500.body.success, false);
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });
});
