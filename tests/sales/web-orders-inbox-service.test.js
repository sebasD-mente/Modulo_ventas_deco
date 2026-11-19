import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma } from '@prisma/client';

import { envSchema } from '../../server/config/env.js';
import { createRemoteSaleSchema } from '../../server/validators/remoteSaleValidators.js';
import { webOrderPayloadSchema } from '../../server/validators/webOrderValidators.js';
import {
  discardWebOrder,
  ingestWebOrderWebhook,
  isWebOrderWebhookAuthorized,
  listWebOrders,
  normalizeWebImageUrl,
  normalizeWebMaterial,
  normalizeWebOrderItem,
  normalizeWebOrderNumber,
  restoreWebOrder,
  syncWebOrdersFromWeb,
} from '../../server/services/sales/webOrderInboxService.js';
import { createRemoteSaleTransaction } from '../../server/services/sales/remoteSaleService.js';
import { prisma } from '../../server/config/prisma.js';
import { handleWebOrderWebhook } from '../../server/controllers/webOrderInboxController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

function createInMemoryWebInboxPrisma(seedProducts = []) {
  const inboxRows = new Map();
  const auditLogs = [];
  let seq = 0;

  return {
    inboxRows,
    auditLogs,
    product: {
      findMany: async ({ where }) => {
        const skus = where?.sku?.in || [];
        return seedProducts.filter((p) => p.tenantId === where.tenantId && skus.includes(p.sku));
      },
    },
    webOrderInbox: {
      findUnique: async ({ where }) => {
        if (where?.id) return inboxRows.get(where.id) || null;
        const composite = where?.tenantId_orderNumber;
        if (composite) {
          for (const r of inboxRows.values()) {
            if (r.tenantId === composite.tenantId && r.orderNumber === composite.orderNumber) return r;
          }
        }
        return null;
      },
      findFirst: async ({ where }) => {
        for (const r of inboxRows.values()) {
          if (where.id && r.id !== where.id) continue;
          if (where.tenantId && r.tenantId !== where.tenantId) continue;
          if (where.orderNumber && r.orderNumber !== where.orderNumber) continue;
          return r;
        }
        return null;
      },
      create: async ({ data }) => {
        const record = {
          id: `woi-${++seq}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          importedSaleId: null,
          importedSaleNumber: null,
          importedById: null,
          importedAt: null,
          discardedById: null,
          discardedAt: null,
          discardReason: null,
          ...data,
        };
        inboxRows.set(record.id, record);
        return record;
      },
      update: async ({ where, data }) => {
        const existing = inboxRows.get(where.id);
        if (!existing) throw new Error('Row not found');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        inboxRows.set(updated.id, updated);
        return updated;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const [id, r] of inboxRows.entries()) {
          if (where.id && r.id !== where.id) continue;
          if (where.tenantId && r.tenantId !== where.tenantId) continue;
          if (where.status?.not && r.status === where.status.not) continue;
          inboxRows.set(id, { ...r, ...data, updatedAt: new Date() });
          count++;
        }
        return { count };
      },
      findMany: async ({ where, skip = 0, take = 50 }) => {
        let list = [...inboxRows.values()].filter((r) => {
          if (where.tenantId && r.tenantId !== where.tenantId) return false;
          if (where.status && r.status !== where.status) return false;
          if (where.orderSource && r.orderSource !== where.orderSource) return false;
          if (Array.isArray(where.OR)) {
            const matchesAny = where.OR.some((cond) => {
              if (cond.orderNumber?.contains) return r.orderNumber.toLowerCase().includes(cond.orderNumber.contains.toLowerCase());
              if (cond.customerName?.contains) return r.customerName.toLowerCase().includes(cond.customerName.contains.toLowerCase());
              if (cond.customerPhone?.contains) return String(r.customerPhone || '').includes(cond.customerPhone.contains);
              return false;
            });
            if (!matchesAny) return false;
          }
          return true;
        });
        list.sort((a, b) => b.createdAt - a.createdAt);
        return list.slice(skip, skip + take);
      },
      count: async ({ where }) => {
        let cnt = 0;
        for (const r of inboxRows.values()) {
          if (where.tenantId && r.tenantId !== where.tenantId) continue;
          if (where.status && r.status !== where.status) continue;
          if (where.orderSource && r.orderSource !== where.orderSource) continue;
          cnt++;
        }
        return cnt;
      },
    },
    auditLog: {
      create: async ({ data }) => {
        auditLogs.push(data);
        return data;
      },
    },
  };
}

describe('feat-022: Bandeja de Pedidos Web (WebOrderInbox), S2S Webhook, Sync Pull y Cierre Atómico', () => {
  describe('1. Esquema Prisma, Validadores, Configuración y Pureza de 6 Capas', () => {
    it('1.1 Prisma.dmmf contiene el modelo WebOrderInbox (@@map("web_order_inbox")) con unicidad (tenantId, orderNumber)', () => {
      const model = Prisma.dmmf.datamodel.models.find((m) => m.name === 'WebOrderInbox');
      assert.ok(model, 'El modelo WebOrderInbox debe existir en Prisma.dmmf');
      assert.equal(model.dbName, 'web_order_inbox');
      const uniqueFields = model.uniqueFields || [];
      assert.ok(
        uniqueFields.some((pair) => pair.length === 2 && pair[0] === 'tenantId' && pair[1] === 'orderNumber'),
        'WebOrderInbox debe declarar @@unique([tenantId, orderNumber])'
      );
      const fieldNames = model.fields.map((f) => f.name);
      for (const reqField of ['status', 'orderSource', 'customerName', 'customerPhone', 'items', 'importedSaleId', 'importedById', 'importedAt']) {
        assert.ok(fieldNames.includes(reqField), `Falta el campo ${reqField} en WebOrderInbox`);
      }
    });

    it('1.2 envSchema soporta WEB_ORDERS_WEBHOOK_SECRET opcional (min 16) y createRemoteSaleSchema acepta webOrderInboxId / webOrderNumber', () => {
      const baseValidEnv = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/eventsales_db',
        JWT_SECRET: 'super_secure_jwt_secret_key_2026',
        GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
        SUPER_ADMIN_EMAILS: 'admin@decovintage.online',
      };
      assert.equal(envSchema.safeParse({ ...baseValidEnv, WEB_ORDERS_WEBHOOK_SECRET: '' }).success, true);
      assert.equal(envSchema.safeParse({ ...baseValidEnv, WEB_ORDERS_WEBHOOK_SECRET: 'short' }).success, false);
      const okEnv = envSchema.safeParse({ ...baseValidEnv, WEB_ORDERS_WEBHOOK_SECRET: 'valid_web_orders_secret_2026' });
      assert.equal(okEnv.success, true);
      assert.equal(okEnv.data.WEB_ORDERS_WEBHOOK_SECRET, 'valid_web_orders_secret_2026');

      const remoteSaleParsed = createRemoteSaleSchema.safeParse({
        customer: { fullName: 'María Fernanda López', phone: '50255112233', deliveryAddress: 'Zona 10, Ciudad de Guatemala' },
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35,
        items: [{ description: 'Personalizado: Familiar (MDF_5_5MM)', quantity: 2, unitPrice: 85.77, isCustom: true, material: 'MDF_5_5MM', customDimensions: 'Especial: 42.2 x 30 cm (Corte Taller)' }],
        payments: [{ method: 'TRANSFERENCIA', amount: 100, reference: 'BOL-901' }],
        webOrderInboxId: 'woi-123',
        webOrderNumber: '#CP-482193',
      });
      assert.equal(remoteSaleParsed.success, true);
      assert.equal(remoteSaleParsed.data.webOrderInboxId, 'woi-123');
    });

    it('1.3 Pureza de capas (0 saltos Controller -> Config, 0 imports superiores en Validators) y 0 CRLF', () => {
      const validatorCode = fs.readFileSync(path.join(ROOT, 'server/validators/webOrderValidators.js'), 'utf8');
      const controllerCode = fs.readFileSync(path.join(ROOT, 'server/controllers/webOrderInboxController.js'), 'utf8');
      const routesCode = fs.readFileSync(path.join(ROOT, 'server/routes/apiRoutes.js'), 'utf8');

      assert.equal(/from\s+['"]\.\.\/(config|services|middleware|controllers|routes)/.test(validatorCode), false);
      assert.equal(/from\s+['"]\.\.\/config\//.test(controllerCode), false, 'webOrderInboxController no debe importar de server/config/');

      const authMiddlewarePos = routesCode.indexOf('router.use(authMiddleware)');
      const webhookPos = routesCode.indexOf("'/webhooks/web-orders'");
      const protectedInboxPos = routesCode.indexOf("'/sales/web-orders'");
      assert.ok(webhookPos > 0 && webhookPos < authMiddlewarePos, 'POST /webhooks/web-orders debe estar antes de authMiddleware');
      assert.ok(protectedInboxPos > authMiddlewarePos, 'GET /sales/web-orders debe estar protegido detrás de authMiddleware');

      for (const rel of [
        'prisma/schema.prisma',
        'server/config/env.js',
        'server/validators/webOrderValidators.js',
        'server/validators/remoteSaleValidators.js',
        'server/services/sales/webOrderInboxService.js',
        'server/services/sales/remoteSaleService.js',
        'server/controllers/webOrderInboxController.js',
        'server/routes/apiRoutes.js',
      ]) {
        const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        assert.equal(raw.includes('\r\n'), false, `${rel} debe tener 0 CRLF`);
      }
    });
  });

  describe('2. Seguridad S2S en Tiempo Constante (isWebOrderWebhookAuthorized & handleWebOrderWebhook)', () => {
    it('2.1 Rechaza secretos ausentes, vacíos, de distinta longitud o incorrectos y acepta WEB_ORDERS_WEBHOOK_SECRET o fallback CATALOG_WEBHOOK_SECRET', async () => {
      const envPrimary = { WEB_ORDERS_WEBHOOK_SECRET: 's2s_primary_secret_deco_2026', CATALOG_WEBHOOK_SECRET: 's2s_catalog_fallback_2026' };
      const envFallback = { WEB_ORDERS_WEBHOOK_SECRET: '', CATALOG_WEBHOOK_SECRET: 's2s_catalog_fallback_2026' };
      const envEmpty = { WEB_ORDERS_WEBHOOK_SECRET: '', CATALOG_WEBHOOK_SECRET: '' };

      assert.equal(isWebOrderWebhookAuthorized({ headers: {} }, { envOverride: envPrimary }), false);
      assert.equal(isWebOrderWebhookAuthorized({ headers: { 'x-webhook-secret': 'short' } }, { envOverride: envPrimary }), false);
      assert.equal(isWebOrderWebhookAuthorized({ headers: { 'x-webhook-secret': 's2s_primary_secret_deco_XXXX' } }, { envOverride: envPrimary }), false);
      assert.equal(isWebOrderWebhookAuthorized({ headers: { 'x-webhook-secret': '' } }, { envOverride: envEmpty }), false);

      assert.equal(isWebOrderWebhookAuthorized({ headers: { 'x-webhook-secret': 's2s_primary_secret_deco_2026' } }, { envOverride: envPrimary }), true);
      assert.equal(isWebOrderWebhookAuthorized({ headers: { authorization: 'Bearer s2s_catalog_fallback_2026' } }, { envOverride: envFallback }), true);

      // Verificación HTTP 401 directa sobre handleWebOrderWebhook sin credenciales
      let status = 200;
      let body = null;
      await handleWebOrderWebhook(
        { headers: {}, body: { orderNumber: 'CP-100', items: [{ title: 'X', quantity: 1, unitPrice: 65 }] } },
        { status(c) { status = c; return this; }, json(p) { body = p; return this; } }
      );
      assert.equal(status, 401);
      assert.equal(body?.success, false);
    });
  });

  describe('3. Normalización de Ítems (Materiales, Medidas Decimales, Precios y URLs Absolutas)', () => {
    it('3.1 Mapea mdf/pvc/vinyl_only, medidas decimales (42.2 x 30 cm), URLs relativas -> absolutas y productId de catálogo', () => {
      assert.equal(normalizeWebOrderNumber('#CP-482193'), 'CP-482193');
      assert.equal(normalizeWebMaterial('mdf'), 'MDF_5_5MM');
      assert.equal(normalizeWebMaterial('pvc'), 'PVC_5MM');
      assert.equal(normalizeWebMaterial('vinyl_only'), 'VINILO_SOLO');
      assert.equal(
        normalizeWebImageUrl('/posters/uploads/custom/arte-familiar.webp', 'https://decovintage.online'),
        'https://decovintage.online/posters/uploads/custom/arte-familiar.webp'
      );
      assert.equal(
        normalizeWebImageUrl('https://storage.googleapis.com/bucket/foto.webp', 'https://decovintage.online'),
        'https://storage.googleapis.com/bucket/foto.webp'
      );

      const customMdf = normalizeWebOrderItem({
        isCustom: true,
        title: 'Retrato Familiar',
        sizeMode: 'custom',
        customWidth: '42,2',
        customHeight: 30,
        baseMaterial: 'mdf',
        quantity: 2,
        imageUrl: '/posters/uploads/custom/retrato.webp',
        customNote: 'Borde limpio',
      });
      assert.equal(customMdf.isCustom, true);
      assert.equal(customMdf.material, 'MDF_5_5MM');
      assert.equal(customMdf.customWidth, 42.2);
      assert.equal(customMdf.customHeight, 30);
      assert.equal(customMdf.customArea, 1266);
      assert.equal(customMdf.customDimensions, 'Especial: 42.2 x 30 cm (Corte Taller)');
      assert.equal(customMdf.unitPrice, 85.77);
      assert.equal(customMdf.subtotal, 171.54);
      assert.equal(customMdf.customImageUrl, 'https://decovintage.online/posters/uploads/custom/retrato.webp');

      const productMap = new Map([['WEB-901', { id: 'prod-uuid-901', sku: 'WEB-901', name: 'Starry Night', imageUrl: 'https://decovintage.online/posters/starry.webp' }]]);
      const catalogItem = normalizeWebOrderItem(
        {
          isCustom: false,
          posterId: '901',
          title: 'Starry Night',
          sizeMode: 'standard',
          selectedStandardSize: { id: 'MEDIANO', name: 'Mediano', dimensions: '30 x 45 cm', price: 65 },
          baseMaterial: 'mdf',
          quantity: 1,
          imageUrl: '/posters/starry.webp',
        },
        { baseOrigin: 'https://decovintage.online', productMapBySku: productMap }
      );
      assert.equal(catalogItem.isCustom, false);
      assert.equal(catalogItem.productId, 'prod-uuid-901');
      assert.equal(catalogItem.sku, 'WEB-901');
      assert.equal(catalogItem.description, 'Starry Night (Mediano)');
      assert.equal(catalogItem.unitPrice, 65);
      assert.equal(catalogItem.imageUrl, 'https://decovintage.online/posters/starry.webp');
    });
  });

  describe('4. Upsert Idempotente, Protección de Estados Terminales, Sync Pull y Descarte/Restauración', () => {
    it('4.1 Upsert actualiza PENDIENTE sin duplicar y JAMÁS revierte órdenes IMPORTADO o DESCARTADO en webhooks ni en Sync Pull', async () => {
      const mockPrisma = createInMemoryWebInboxPrisma([
        { id: 'prod-10', tenantId: 'tenant-1', sku: 'WEB-55', name: 'Pulp Fiction', imageUrl: 'https://decovintage.online/posters/pulp.webp' },
      ]);
      const envOverride = { WEB_ORDERS_WEBHOOK_SECRET: 's2s_test_secret_1234567890', WEB_CATALOG_URL: 'https://decovintage.online' };

      const webhookPayload = {
        event: 'web_order.created',
        order: {
          externalOrderId: 'ext-uuid-1',
          orderNumber: '#CP-482193',
          orderSource: 'WEB_CUSTOM',
          customer: { fullName: 'María Fernanda López', phone: '+502 5511-2233', address: 'Zona 10, Ciudad', department: 'Guatemala' },
          items: [{ isCustom: true, title: 'Cuadro 1', sizeMode: 'custom', customWidth: 42.2, customHeight: 30, baseMaterial: 'mdf', quantity: 2, unitPrice: 85.77, imageUrl: '/posters/uploads/custom/f1.webp' }],
        },
      };
      assert.equal(webOrderPayloadSchema.safeParse(webhookPayload).success, true);

      const first = await ingestWebOrderWebhook({ tenantId: 'tenant-1', payload: webhookPayload, prismaClient: mockPrisma, envOverride });
      assert.equal(first.action, 'CREATED');
      assert.equal(first.record.orderNumber, 'CP-482193');
      assert.equal(first.record.customerPhone, '50255112233');
      assert.equal(first.record.quotedTotal, 171.54);

      // Segundo envío del mismo pedido (sin #) actualiza sin duplicar
      const second = await ingestWebOrderWebhook({
        tenantId: 'tenant-1',
        payload: { ...webhookPayload.order, orderNumber: 'CP-482193', customer: { fullName: 'María F. López', phone: '50255112233', address: 'Zona 14, Ciudad' } },
        prismaClient: mockPrisma,
        envOverride,
      });
      assert.equal(second.action, 'UPDATED');
      assert.equal(mockPrisma.inboxRows.size, 1);
      assert.equal(second.record.customerAddress, 'Zona 14, Ciudad');

      // Descartar y verificar callback S2S CANCELADO
      const s2sCalls = [];
      const mockFetch = async (url, opts) => {
        s2sCalls.push({ url, method: opts?.method || 'GET', headers: opts?.headers, body: opts?.body ? JSON.parse(opts.body) : null });
        if ((opts?.method || 'GET') === 'GET') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: [
                webhookPayload.order, // CP-482193 (actualmente DESCARTADO, no debe revertirse)
                {
                  orderNumber: 'CP-482194',
                  orderSource: 'WEB_CART',
                  customer: { fullName: 'Carlos Ruiz', phone: '50244112233' },
                  items: [{ isCustom: false, posterId: '55', title: 'Pulp Fiction', sizeMode: 'standard', sizeId: 'MEDIANO', quantity: 1, unitPrice: 65, imageUrl: '/posters/pulp.webp' }],
                },
              ],
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      const discarded = await discardWebOrder({
        tenantId: 'tenant-1',
        id: first.record.id,
        userId: 'seller-1',
        reason: 'Pedido duplicado por cliente',
        fetchImpl: mockFetch,
        prismaClient: mockPrisma,
        envOverride,
      });
      assert.equal(discarded.status, 'DESCARTADO');
      assert.equal(s2sCalls.length, 1);
      assert.equal(s2sCalls[0].method, 'PATCH');
      assert.match(s2sCalls[0].url, /\/api\/custom-orders\/integration\/CP-482193\/status$/);
      assert.deepEqual(s2sCalls[0].body, { status: 'CANCELADO' });

      // Sync Pull trae CP-482193 (DESCARTADO) y CP-482194 (nuevo): salta CP-482193 y crea CP-482194
      const syncRes = await syncWebOrdersFromWeb({ tenantId: 'tenant-1', fetchImpl: mockFetch, prismaClient: mockPrisma, envOverride });
      assert.equal(syncRes.success, true);
      assert.equal(syncRes.createdCount, 1);
      assert.equal(syncRes.skippedCount, 1);
      assert.equal(mockPrisma.inboxRows.get(first.record.id).status, 'DESCARTADO');

      // Restaurar CP-482193 a PENDIENTE
      const restored = await restoreWebOrder({
        tenantId: 'tenant-1',
        id: first.record.id,
        userId: 'seller-1',
        fetchImpl: mockFetch,
        prismaClient: mockPrisma,
        envOverride,
      });
      assert.equal(restored.status, 'PENDIENTE');
      assert.equal(restored.discardReason, null);
      assert.deepEqual(s2sCalls[s2sCalls.length - 1].body, { status: 'PENDIENTE' });

      // Aislamiento Multi-Tenant y contadores en listWebOrders
      const tenant1List = await listWebOrders({ tenantId: 'tenant-1', status: 'PENDIENTE', prismaClient: mockPrisma });
      const tenant2List = await listWebOrders({ tenantId: 'tenant-otro', status: 'PENDIENTE', prismaClient: mockPrisma });
      assert.equal(tenant1List.total, 2);
      assert.deepEqual(tenant1List.counts, { pending: 2, imported: 0, discarded: 0 });
      assert.equal(tenant2List.total, 0);
    });
  });

  describe('5. Cierre Atómico en createRemoteSaleTransaction (Candado 409 + Sello [Origen Web: #CP-XXXX])', () => {
    it('5.1 Marca atómicamente IMPORTADO al crear la venta, estampa [Origen Web: #CP-XXXX], notifica S2S y bloquea con HTTP 409 cualquier doble importación', async () => {
      const origTransaction = prisma.$transaction;
      const origFetch = globalThis.fetch;
      const prevSecret = process.env.WEB_ORDERS_WEBHOOK_SECRET;
      const prevCatalogUrl = process.env.WEB_CATALOG_URL;

      const mockStore = createInMemoryWebInboxPrisma();
      const seeded = await ingestWebOrderWebhook({
        tenantId: 'tenant-deco',
        payload: {
          orderNumber: 'CP-777001',
          orderSource: 'WEB_CUSTOM',
          customer: { fullName: 'Ana Lucía Morales', phone: '50233445566', address: 'Antigua Guatemala' },
          items: [{ isCustom: true, title: 'Volcán de Agua', sizeMode: 'custom', customWidth: 42.2, customHeight: 30, baseMaterial: 'mdf', quantity: 2, unitPrice: 85.77, imageUrl: 'https://decovintage.online/posters/uploads/custom/volcan.webp' }],
        },
        prismaClient: mockStore,
      });

      const createdSales = [];
      const outboundPatches = [];

      process.env.WEB_ORDERS_WEBHOOK_SECRET = 's2s_atomic_sale_secret_2026';
      process.env.WEB_CATALOG_URL = 'https://decovintage.online';
      globalThis.fetch = async (url, opts) => {
        outboundPatches.push({ url, method: opts?.method, body: opts?.body ? JSON.parse(opts.body) : null });
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      };

      prisma.$transaction = async (fn) =>
        fn({
          webOrderInbox: mockStore.webOrderInbox,
          customer: {
            findUnique: async () => null,
            create: async ({ data }) => ({ id: 'cust-ana-1', ...data }),
          },
          event: {
            upsert: async () => ({ id: 'evt-ventas-redes-online', name: 'Ventas en Línea', currentSaleSequence: createdSales.length + 1 }),
            update: async () => ({ id: 'evt-ventas-redes-online', name: 'Ventas en Línea', currentSaleSequence: createdSales.length + 1 }),
            findUnique: async () => ({ id: 'evt-ventas-redes-online', name: 'Ventas en Línea', currentSaleSequence: createdSales.length + 1 }),
          },
          sale: {
            findFirst: async () => null,
            create: async ({ data }) => {
              const s = { id: `sale-${createdSales.length + 1}`, ...data, items: data.items.create, payments: data.payments.create };
              createdSales.push(s);
              return s;
            },
          },
          auditLog: mockStore.auditLog,
        });

      try {
        const salePayload = {
          eventId: 'evt-ventas-redes-online',
          customer: { fullName: 'Ana Lucía Morales', phone: '50233445566', deliveryAddress: 'Antigua Guatemala' },
          deliveryMethod: 'ENVIO_COURIER',
          shippingCost: 35,
          editionDescription: 'Texto conmemorativo inferior',
          editionCost: 25,
          items: [
            {
              description: 'Personalizado: Volcán de Agua (MDF_5_5MM, Especial: 42.2 x 30 cm (Corte Taller))',
              quantity: 2,
              unitPrice: 85.77,
              isCustom: true,
              material: 'MDF_5_5MM',
              customDimensions: 'Especial: 42.2 x 30 cm (Corte Taller)',
              customImageUrl: 'https://decovintage.online/posters/uploads/custom/volcan.webp',
            },
          ],
          payments: [{ method: 'TRANSFERENCIA', amount: 100, reference: 'REF-777' }],
          notes: 'Enviar bien protegido',
          webOrderInboxId: seeded.record.id,
        };

        const sale = await createRemoteSaleTransaction({
          tenantId: 'tenant-deco',
          sellerId: 'seller-redes-1',
          data: salePayload,
        });

        assert.equal(sale.totalAmount, 231.54); // 171.54 + 25 edición + 35 flete
        assert.match(sale.notes, /\[Origen Web: #CP-777001\]/);
        assert.match(sale.notes, /\[Edición \(\+Q 25\.00\): Texto conmemorativo inferior\]/);

        const updatedInbox = mockStore.inboxRows.get(seeded.record.id);
        assert.equal(updatedInbox.status, 'IMPORTADO');
        assert.equal(updatedInbox.importedSaleId, sale.id);
        assert.equal(updatedInbox.importedSaleNumber, sale.saleNumber);
        assert.equal(updatedInbox.importedById, 'seller-redes-1');
        assert.ok(updatedInbox.importedAt instanceof Date);

        assert.equal(outboundPatches.length, 1);
        assert.equal(outboundPatches[0].method, 'PATCH');
        assert.match(outboundPatches[0].url, /\/api\/custom-orders\/integration\/CP-777001\/status$/);
        assert.deepEqual(outboundPatches[0].body, {
          status: 'IMPORTADO',
          externalSaleNumber: sale.saleNumber,
        });

        // Segundo intento sobre el mismo pedido ya IMPORTADO debe rechazarse con HTTP 409 y 0 ventas extra
        await assert.rejects(
          () =>
            createRemoteSaleTransaction({
              tenantId: 'tenant-deco',
              sellerId: 'seller-redes-2',
              data: salePayload,
            }),
          (err) => err?.statusCode === 409 && /ya fue importado/i.test(err.message)
        );
        assert.equal(createdSales.length, 1, 'No debe crearse una segunda venta duplicada tras el rechazo 409');

        // Tampoco se permite descartar ni restaurar un pedido ya IMPORTADO
        await assert.rejects(
          () => discardWebOrder({ tenantId: 'tenant-deco', id: seeded.record.id, prismaClient: mockStore }),
          (err) => err?.statusCode === 409
        );
        await assert.rejects(
          () => restoreWebOrder({ tenantId: 'tenant-deco', id: seeded.record.id, prismaClient: mockStore }),
          (err) => err?.statusCode === 409
        );
      } finally {
        prisma.$transaction = origTransaction;
        globalThis.fetch = origFetch;
        if (prevSecret === undefined) delete process.env.WEB_ORDERS_WEBHOOK_SECRET;
        else process.env.WEB_ORDERS_WEBHOOK_SECRET = prevSecret;
        if (prevCatalogUrl === undefined) delete process.env.WEB_CATALOG_URL;
        else process.env.WEB_CATALOG_URL = prevCatalogUrl;
      }
    });
  });
});
