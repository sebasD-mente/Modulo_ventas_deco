import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secure_commission_edition_feat020_jwt_secret_2026';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS || 'superadmin@dekolabs.org';

import { prisma } from '../../server/config/prisma.js';
import {
  extractSaleEditionCost,
  calculateSaleProductBase,
  getPendingCommissions,
  createSettlementTransaction,
  getSettlementById,
} from '../../server/services/commissionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

async function loadModuleHeaderExports(relPath, splitMarker) {
  const fullPath = path.join(ROOT, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const splitIdx = source.indexOf(splitMarker);
  assert.ok(splitIdx > 0, `${relPath} debe contener "${splitMarker}"`);
  const headerOnly = source.slice(0, splitIdx).replace(/^import\s+[^\n]*from\s+['"][^'"]+['"];?\r?\n/gm, '');
  const dataUrl = `data:text/javascript;base64,${Buffer.from(headerOnly, 'utf8').toString('base64')}`;
  return import(dataUrl);
}

const receiptHelpers = await loadModuleHeaderExports(
  'src/components/commissions/SettlementDetailReceiptModal.jsx',
  'export default function SettlementDetailReceiptModal'
);

describe('feat-020: Inclusión del Costo de Edición de Diseño en la Base Comisionable del 20% (Excluyendo Únicamente el Flete)', () => {
  describe('1. Extracción Determinista del Cargo de Edición (extractSaleEditionCost)', () => {
    it('1.1 extrae editionCost directo o desde el sello "[Edición (+Q X.XX): ...]" en sale.notes (incluyendo notas multilínea tras cobro de saldo)', () => {
      assert.equal(extractSaleEditionCost({ editionCost: 25 }), 25);
      assert.equal(extractSaleEditionCost({ editionCost: '18.5' }), 18.5);
      assert.equal(extractSaleEditionCost({ editionCost: 0 }), 0);
      assert.equal(extractSaleEditionCost({ editionCost: -15 }), 0);

      assert.equal(
        extractSaleEditionCost({
          notes: '[Edición (+Q 25.00): Se agregaron letras en la esquina inferior]',
        }),
        25
      );

      assert.equal(
        extractSaleEditionCost({
          notes:
            'Cliente pide envoltura especial\n[Edición (+Q 32.50): Collage de 3 fotos y fecha]\n[Saldo Q130.00 cobrado por: Vendedor Redes (VENDEDOR_REDES)]',
        }),
        32.5
      );

      assert.equal(
        extractSaleEditionCost({
          notes: '[Edicion (+Q 15.75): Ajuste de brillo sin tilde]',
        }),
        15.75
      );

      assert.equal(
        extractSaleEditionCost({
          notes: '[Edición (+Q 0.00): Ajuste de cortesía sin cobro]',
        }),
        0
      );

      assert.equal(extractSaleEditionCost({ notes: 'Entrega el sábado por la tarde' }), 0);
      assert.equal(extractSaleEditionCost(null), 0);
      assert.equal(extractSaleEditionCost(undefined), 0);
    });
  });

  describe('2. Cálculo de Base Comisionable del 20% (calculateSaleProductBase)', () => {
    it('2.1 suma pósters + edición de diseño (Q 130 + Q 25 = Q 155 -> Q 31.00) tanto en memoria como desde registro Prisma, excluyendo el 100% del flete', () => {
      const inMemorySale = {
        items: [{ quantity: 2, unitPrice: 65, subtotal: 130 }],
        discount: 0,
        editionCost: 25,
        shippingCost: 35,
        totalAmount: 190,
      };
      assert.equal(calculateSaleProductBase(inMemorySale), 155);
      assert.equal(Number((calculateSaleProductBase(inMemorySale) * 0.20).toFixed(2)), 31);

      const prismaPersistedSale = {
        items: [{ quantity: 2, unitPrice: 65, subtotal: 130 }],
        discount: 0,
        shippingCost: 35,
        totalAmount: 190,
        notes: 'Revisión aprobada\n[Edición (+Q 25.00): Se agregaron letras en la esquina inferior]',
      };
      assert.equal(calculateSaleProductBase(prismaPersistedSale), 155);
      assert.equal(Number((calculateSaleProductBase(prismaPersistedSale) * 0.20).toFixed(2)), 31);
    });

    it('2.2 combina correctamente productos + descuento + edición + flete sin contaminar nunca con shippingCost ni duplicar en fallback', () => {
      for (const shippingCost of [0, 35, 500]) {
        const sale = {
          itemsSubtotal: 200,
          discount: 30,
          shippingCost,
          totalAmount: 170 + 25 + shippingCost,
          notes: '[Edición (+Q 25.00): Tipografía dorada]',
        };
        const base = calculateSaleProductBase(sale);
        assert.equal(base, 195, `Con flete Q ${shippingCost}, la base debe ser exactamente Q 195.00`);
        assert.equal(Number((base * 0.20).toFixed(2)), 39);
      }

      // Descuento superior al subtotal de productos trunca productos a 0 y mantiene el cargo pagado de edición
      const overDiscountedWithEdition = {
        itemsSubtotal: 50,
        discount: 80,
        shippingCost: 35,
        totalAmount: 60,
        notes: '[Edición (+Q 25.00): Montaje fotográfico]',
      };
      assert.equal(calculateSaleProductBase(overDiscountedWithEdition), 25);

      // Fallback sin itemsSubtotal ni items: totalAmount - shippingCost ya incluye edición (cero doble conteo)
      const rawFallbackSale = {
        totalAmount: 190,
        shippingCost: 35,
        discount: 0,
        notes: '[Edición (+Q 25.00): Se agregaron letras]',
      };
      assert.equal(calculateSaleProductBase(rawFallbackSale), 155);
    });
  });

  describe('3. Integración en getPendingCommissions, createSettlementTransaction y getSettlementById', () => {
    it('3.1 getPendingCommissions incluye la edición en ventas elegibles y en waitingSummary.potentialCommission (excluyendo flete)', async () => {
      const origFindMany = prisma.sale.findMany;
      let callCount = 0;
      try {
        prisma.sale.findMany = async () => {
          callCount += 1;
          if (callCount === 1) {
            return [
              {
                id: 'sale-ed-ready',
                saleNumber: 'RED-701',
                sellerId: 'seller-redes-1',
                orderType: 'REDES_PERSONALIZADO',
                items: [{ quantity: 2, unitPrice: 65, subtotal: 130 }],
                discount: 0,
                shippingCost: 35,
                totalAmount: 190,
                balanceDue: 0,
                status: 'COMPLETADA',
                commissionPaid: false,
                commissionSettlementId: null,
                notes: '[Edición (+Q 25.00): Se agregaron letras]\n[Saldo Q130.00 cobrado por: Vendedor Redes]',
                createdAt: new Date('2026-11-15T16:00:00Z'),
              },
              {
                id: 'sale-plain-ready',
                saleNumber: 'RED-702',
                sellerId: 'seller-redes-1',
                orderType: 'REDES_PERSONALIZADO',
                items: [{ quantity: 1, unitPrice: 100, subtotal: 100 }],
                discount: 0,
                shippingCost: 30,
                totalAmount: 130,
                balanceDue: 0,
                status: 'COMPLETADA',
                commissionPaid: false,
                commissionSettlementId: null,
                notes: null,
                createdAt: new Date('2026-11-16T16:00:00Z'),
              },
            ];
          }
          return [
            {
              id: 'sale-ed-waiting',
              saleNumber: 'RED-703',
              sellerId: 'seller-redes-1',
              orderType: 'REDES_PERSONALIZADO',
              items: [{ quantity: 1, unitPrice: 80, subtotal: 80 }],
              discount: 0,
              shippingCost: 35,
              totalAmount: 135,
              balanceDue: 85,
              status: 'PENDIENTE',
              notes: '[Edición (+Q 20.00): Dedicatoria inferior]',
              createdAt: new Date('2026-11-17T16:00:00Z'),
            },
          ];
        };

        const pending = await getPendingCommissions({
          tenantId: 'tenant-deko',
          sellerId: 'seller-redes-1',
        });

        assert.equal(pending.salesCount, 2);
        assert.equal(pending.sales[0].baseProductos, 155);
        assert.equal(pending.sales[0].commissionAmount, 31);
        assert.equal(pending.sales[1].baseProductos, 100);
        assert.equal(pending.sales[1].commissionAmount, 20);
        assert.equal(pending.totalProductsAmount, 255);
        assert.equal(pending.totalShippingExcluded, 65);
        assert.equal(pending.totalCommission, 51);

        // En espera: (Q80 cuadro + Q20 edición) * 20% = Q 20.00 (flete Q35 excluido)
        assert.equal(pending.waitingSummary.count, 1);
        assert.equal(pending.waitingSummary.totalBalance, 85);
        assert.equal(pending.waitingSummary.potentialCommission, 20);
      } finally {
        prisma.sale.findMany = origFindMany;
      }
    });

    it('3.2 createSettlementTransaction y getSettlementById persisten y enriquecen la base con edición de diseño', async () => {
      const origTx = prisma.$transaction;
      const origFindFirst = prisma.commissionSettlement.findFirst;
      let createdSettlementPayload = null;

      const persistedSaleWithEdition = {
        id: 'sale-ed-settle-1',
        saleNumber: 'RED-801',
        sellerId: 'seller-redes-1',
        orderType: 'REDES_PERSONALIZADO',
        items: [{ quantity: 2, unitPrice: 65, subtotal: 130 }],
        discount: 0,
        shippingCost: 35,
        totalAmount: 190,
        balanceDue: 0,
        status: 'COMPLETADA',
        commissionPaid: false,
        commissionSettlementId: null,
        notes: '[Edición (+Q 25.00): Se agregaron letras en la esquina inferior]',
        createdAt: new Date('2026-11-17T15:00:00Z'),
      };

      try {
        prisma.$transaction = async (cb) =>
          cb({
            user: { findFirst: async () => ({ id: 'seller-redes-1', fullName: 'Vendedor Redes', email: 'redes@dekolabs.org' }) },
            sale: {
              findMany: async () => [persistedSaleWithEdition],
              updateMany: async () => ({ count: 1 }),
            },
            commissionSettlement: {
              findMany: async () => [],
              create: async ({ data }) => {
                createdSettlementPayload = data;
                return { id: 'settlement-ed-020', ...data, createdAt: new Date() };
              },
            },
            auditLog: { create: async () => ({}) },
          });

        const created = await createSettlementTransaction({
          tenantId: 'tenant-deko',
          sellerId: 'seller-redes-1',
          saleIds: ['sale-ed-settle-1'],
          approvedById: 'admin-deko',
        });

        assert.equal(createdSettlementPayload.totalProductsAmount, 155);
        assert.equal(createdSettlementPayload.totalCommission, 31);
        assert.equal(created.totalProductsAmount, 155);
        assert.equal(created.totalCommission, 31);

        prisma.commissionSettlement.findFirst = async () => ({
          id: 'settlement-ed-020',
          tenantId: 'tenant-deko',
          sellerId: 'seller-redes-1',
          settlementNumber: 'LIQ-202611-001',
          totalProductsAmount: 155,
          totalCommission: 31,
          status: 'PENDIENTE_PAGO',
          sales: [persistedSaleWithEdition],
        });

        const detail = await getSettlementById({
          tenantId: 'tenant-deko',
          settlementId: 'settlement-ed-020',
        });

        assert.equal(detail.sales.length, 1);
        assert.equal(detail.sales[0].baseProductos, 155);
        assert.equal(detail.sales[0].commissionAmount, 31);
      } finally {
        prisma.$transaction = origTx;
        prisma.commissionSettlement.findFirst = origFindFirst;
      }
    });
  });

  describe('4. Consistencia en SettlementDetailReceiptModal.jsx y Guardarraíles de Higiene', () => {
    it('4.1 calculateReceiptRowAmounts respeta baseProductos === 0 (??), incluye edición en fallback y conserva techos y 0 CRLF', () => {
      assert.deepEqual(receiptHelpers.calculateReceiptRowAmounts({ baseProductos: 0, totalAmount: 99, discount: 99 }), {
        base: 0,
        comm: 0,
      });
      assert.deepEqual(receiptHelpers.calculateReceiptRowAmounts({ baseProductos: 155, shippingCost: 35, totalAmount: 190 }), {
        base: 155,
        comm: 31,
      });
      assert.deepEqual(
        receiptHelpers.calculateReceiptRowAmounts({
          itemsSubtotal: 130,
          discount: 10,
          notes: '[Edición (+Q 25.00): Letras]',
          shippingCost: 35,
          totalAmount: 180,
        }),
        { base: 145, comm: 29 }
      );
      assert.deepEqual(
        receiptHelpers.calculateReceiptRowAmounts({
          notes: '[Edición (+Q 25.00): Letras]',
          shippingCost: 35,
          totalAmount: 190,
        }),
        { base: 155, comm: 31 }
      );

      const receiptPath = path.join(ROOT, 'src/components/commissions/SettlementDetailReceiptModal.jsx');
      const receiptSource = fs.readFileSync(receiptPath, 'utf8');
      assert.ok(receiptSource.includes('s.baseProductos ??'), 'Debe preservar estrictamente s.baseProductos ??');
      assert.ok(!receiptSource.includes('s.baseProductos ||'), 'Prohibido usar s.baseProductos ||');
      assert.ok(receiptSource.split('\n').length <= 280, 'SettlementDetailReceiptModal.jsx debe mantenerse <= 280L');

      for (const rel of [
        'server/services/commissionService.js',
        'src/components/commissions/SettlementDetailReceiptModal.jsx',
        'tests/sales/remote-sale-design-edition.test.js',
        'tests/commissions/commission-design-edition-inclusion.test.js',
        'tests/adversarial/m3-commission-invariants-challenger.test.js',
      ]) {
        const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        assert.equal(raw.includes('\r\n'), false, `${rel} debe tener 0 CRLF`);
      }
    });
  });
});
