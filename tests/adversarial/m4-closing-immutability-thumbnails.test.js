import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { updateSaleTransaction } from '../../server/services/sales/saleUpdateService.js';
import { updateSale } from '../../server/controllers/saleController.js';
import { getGuatemalaDayRange } from '../../server/services/sales/saleKpiService.js';
import { prisma } from '../../server/config/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ ADVERSARIAL CHALLENGER: INMUTABILIDAD CONTABLE, JORNADAS Y MINIATURAS', () => {

  // =========================================================================
  // BLOQUE 1: INMUTABILIDAD DE DÍAS CERRADOS (HTTP 403)
  // =========================================================================
  describe('1. Inmutabilidad Contable en updateSaleTransaction', () => {

    it('1.1 Rechaza modificación de ventas de días pasados con 403', async () => {
      const originalTx = prisma.$transaction;
      try {
        const yesterday = new Date(Date.now() - 86400000 * 2).toISOString();
        prisma.$transaction = async (cb) => {
          return await cb({
            sale: {
              findFirst: async () => ({
                id: 'sale-past-1',
                tenantId: 'tenant-1',
                eventId: 'event-1',
                createdAt: yesterday,
                totalAmount: 100,
                discount: 0,
                items: [],
                payments: [],
              }),
            },
            cashClosing: {
              findFirst: async () => null,
            },
          });
        };

        await assert.rejects(
          async () => {
            await updateSaleTransaction({
              saleId: 'sale-past-1',
              tenantId: 'tenant-1',
              userId: 'seller-1',
              items: [{ description: 'Póster', quantity: 1, unitPrice: 100 }],
            });
          },
          (err) => {
            assert.equal(err.statusCode, 403);
            assert.match(err.message, /No se puede modificar una venta de una jornada cerrada o anterior\./);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('1.2 Rechaza modificación de ventas de hoy si ya existe un CashClosing', async () => {
      const originalTx = prisma.$transaction;
      try {
        const today = new Date().toISOString();
        prisma.$transaction = async (cb) => {
          return await cb({
            sale: {
              findFirst: async () => ({
                id: 'sale-today-1',
                tenantId: 'tenant-1',
                eventId: 'event-1',
                createdAt: today,
                totalAmount: 200,
                discount: 0,
                items: [],
                payments: [],
              }),
            },
            cashClosing: {
              findFirst: async () => ({
                id: 'closing-1',
                closingType: 'DIARIO',
                closingDate: new Date(),
              }),
            },
          });
        };

        await assert.rejects(
          async () => {
            await updateSaleTransaction({
              saleId: 'sale-today-1',
              tenantId: 'tenant-1',
              userId: 'seller-1',
              items: [{ description: 'Póster Nuevo', quantity: 2, unitPrice: 100 }],
            });
          },
          (err) => {
            assert.equal(err.statusCode, 403);
            assert.match(err.message, /No se puede modificar una venta de una jornada cerrada o anterior\./);
            return true;
          }
        );
      } finally {
        prisma.$transaction = originalTx;
      }
    });

    it('1.3 saleController.updateSale propaga status HTTP 403 ante jornada cerrada', async () => {
      const originalTx = prisma.$transaction;
      try {
        const pastDate = '2025-01-01T12:00:00.000Z';
        prisma.$transaction = async (cb) => {
          return await cb({
            sale: {
              findFirst: async () => ({
                id: 'sale-closed',
                tenantId: 'tenant-1',
                eventId: 'event-1',
                createdAt: pastDate,
                items: [],
                payments: [],
              }),
            },
          });
        };

        let responseStatus = null;
        let responseJson = null;
        const req = {
          params: { id: 'sale-closed' },
          body: { items: [] },
          tenantId: 'tenant-1',
          user: { id: 'user-1' },
        };
        const res = {
          status: (code) => {
            responseStatus = code;
            return res;
          },
          json: (data) => {
            responseJson = data;
            return res;
          },
        };

        await updateSale(req, res);
        assert.equal(responseStatus, 403);
        assert.equal(responseJson.success, false);
        assert.match(responseJson.error, /No se puede modificar una venta de una jornada cerrada o anterior\./);
      } finally {
        prisma.$transaction = originalTx;
      }
    });
  });

  // =========================================================================
  // BLOQUE 2: TECHOS ESTRICTOS DE LÍNEAS DE ARQUITECTURA
  // =========================================================================
  describe('2. Verificación Estricta de Techos de Líneas', () => {
    const files = [
      { file: 'server/services/sales/saleUpdateService.js', max: 170 },
      { file: 'server/services/sales/saleTransactionService.js', max: 170 },
      { file: 'server/services/sales/saleKpiService.js', max: 190 },
      { file: 'server/controllers/saleController.js', max: 160 },
      { file: 'src/components/sales/RecentSaleRow.jsx', max: 90 },
      { file: 'src/components/sales/edit/EditSaleItemsTable.jsx', max: 100 },
      { file: 'src/components/events/hooks/useEventsManager.js', max: 160 },
      { file: 'src/components/events/daily/EventDayCard.jsx', max: 140 },
      { file: 'src/components/events/modals/EventSalesModal.jsx', max: 120 },
    ];

    for (const { file, max } of files) {
      it(`${file} existe y cumple techo de <= ${max} líneas`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `Archivo ausente: ${file}`);
        const lines = fs.readFileSync(fullPath, 'utf-8').trim().split('\n').length;
        assert.ok(lines <= max, `Exceso en ${file}: ${lines} > límite ${max}`);
        assert.ok(lines <= 200, `Exceso absoluto en ${file}: ${lines} > 200`);
      });
    }
  });

  // =========================================================================
  // BLOQUE 3: CONTRATOS MODULARES Y MINIATURAS VISUALES
  // =========================================================================
  describe('3. Contratos Modulares de UI y Miniaturas Visuales', () => {
    it('3.1 RecentSaleRow renderiza miniaturas con fallback ImageIcon', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/sales/RecentSaleRow.jsx'), 'utf-8');
      assert.match(content, /ImageIcon/);
      assert.match(content, /it\.product\?\.imageUrl\s*\|\|\s*it\.imageUrl\s*\|\|\s*it\.thumbUrl/);
    });

    it('3.2 EditSaleItemsTable renderiza miniaturas visuales antes de alterar cantidad', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/sales/edit/EditSaleItemsTable.jsx'), 'utf-8');
      assert.match(content, /ImageIcon/);
      assert.match(content, /it\.product\?\.imageUrl\s*\|\|\s*it\.imageUrl\s*\|\|\s*it\.thumbUrl/);
    });

    it('3.3 EventSalesModal integra EventDayCard y agrupa por fecha', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/events/modals/EventSalesModal.jsx'), 'utf-8');
      assert.match(content, /import\s+EventDayCard\s+from/);
      assert.match(content, /closingsList/);
      assert.match(content, /<EventDayCard/);
    });

    it('3.4 EventDayCard implementa badges para DIARIO, AUTOMATICO_MEDIANOCHE y En curso', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/events/daily/EventDayCard.jsx'), 'utf-8');
      assert.match(content, /AUTOMATICO_MEDIANOCHE/);
      assert.match(content, /DIARIO/);
      assert.match(content, /Jornada en curso/);
      assert.match(content, /Inmutable \/ Cerrada/);
    });
  });
});
