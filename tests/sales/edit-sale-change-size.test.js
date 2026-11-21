import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secure_edit_sale_size_feat025_secret_2026';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS || 'superadmin@dekolabs.org';

import {
  buildReplacedPosterFields,
  buildSizeChangedFields,
  hydrateEditableSaleItem,
  resolveEditableItemSizes,
  stripTrailingStandardSize,
} from '../../src/utils/editSaleItemSizes.js';
import { prisma } from '../../server/config/prisma.js';
import { updateSaleTransaction } from '../../server/services/sales/saleUpdateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('feat-025: Selector de Cambio de Tamaño de Póster en Editar Venta de Mostrador', () => {
  describe('1. Capa 1 (src/utils/editSaleItemSizes.js): Resolución e Inmutabilidad de Tallas', () => {
    it('1.1 Es 100% puro sin imports hacia capas superiores ni CRLF', () => {
      const raw = fs.readFileSync(path.join(ROOT, 'src/utils/editSaleItemSizes.js'), 'utf8');
      assert.equal(raw.includes('\r\n'), false, 'editSaleItemSizes.js debe tener 0 CRLF');
      assert.doesNotMatch(raw, /^\s*import\s+/m, 'editSaleItemSizes.js no debe tener imports hacia capas superiores');
    });

    it('1.2 Hidrata tallas desde product.sizes o fallback oficial, respeta paréntesis en títulos y excluye ítems personalizados cm²', () => {
      const itemWithProduct = hydrateEditableSaleItem({
        id: 'it-1',
        productId: 'uuid-luffy',
        description: 'Póster Goku (Ultra Instinto) (Mediano)',
        quantity: 2,
        unitPrice: 65,
        subtotal: 130,
        product: {
          id: 'uuid-luffy',
          name: 'Goku (Ultra Instinto)',
          sizes: [
            { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
            { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
            { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
            { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
          ],
        },
      });

      assert.equal(itemWithProduct.selectedSizeId, 'MEDIANO');
      assert.deepEqual(itemWithProduct.availableSizes.map((s) => s.sizeId), ['MINI', 'PEQUENO', 'MEDIANO', 'GRANDE']);
      assert.equal(stripTrailingStandardSize(itemWithProduct.description), 'Póster Goku (Ultra Instinto)');

      const changed = buildSizeChangedFields(itemWithProduct, { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 });
      assert.equal(changed.description, 'Póster Goku (Ultra Instinto) (Grande)');
      assert.equal(changed.unitPrice, 125);
      assert.equal(changed.selectedSizeId, 'GRANDE');
      assert.equal(changed.subtotal, 250);

      const albumItem = hydrateEditableSaleItem({
        id: 'it-album',
        description: 'Póster Queen - At the Beeb (Portada de Álbum)',
        quantity: 1,
        unitPrice: 55,
        product: { sizes: [{ sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', precio: 55 }] },
      });
      assert.equal(albumItem.selectedSizeId, 'PORTADA_ALBUM');
      assert.equal(albumItem.availableSizes.length, 1);

      const customItem = resolveEditableItemSizes({
        description: 'Personalizado: Foto Boda (MDF_5_5MM, Especial: 42.2 x 30.5 cm (Corte Taller))',
        isCustom: true,
        customDimensions: 'Especial: 42.2 x 30.5 cm (Corte Taller)',
        unitPrice: 86.78,
      });
      assert.deepEqual(customItem, []);
    });

    it('1.3 Al cambiar diseño (buildReplacedPosterFields) conserva la talla si existe y actualiza availableSizes para seguir editando tamaño', () => {
      const current = hydrateEditableSaleItem({
        id: 'it-2',
        description: 'Póster Spider-Man (Grande)',
        quantity: 1,
        unitPrice: 125,
      });

      const swapped = buildReplacedPosterFields(current, {
        id: '550e8400-e29b-41d4-a716-446655440099',
        titulo: 'The Godfather',
        subtitulo: 'Dinastía Corleone',
        sizes: [
          { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
          { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
          { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 210 },
        ],
      });

      assert.equal(swapped.nextDescription, 'Póster The Godfather - Dinastía Corleone (Grande)');
      assert.equal(swapped.nextUnitPrice, 125);
      assert.equal(swapped.selectedSizeId, 'GRANDE');
      assert.deepEqual(swapped.availableSizes.map((s) => s.sizeId), ['MEDIANO', 'GRANDE', 'GIGANTE']);
    });
  });

  describe('2. UI, Hook, Techos Modulares Estrictos y Ergonomía (>= 44px, Sin Naranja)', () => {
    const modalRaw = fs.readFileSync(path.join(ROOT, 'src/components/EditSaleModal.jsx'), 'utf8');
    const hookRaw = fs.readFileSync(path.join(ROOT, 'src/components/sales/edit/hooks/useEditSaleForm.js'), 'utf8');
    const tableRaw = fs.readFileSync(path.join(ROOT, 'src/components/sales/edit/EditSaleItemsTable.jsx'), 'utf8');

    it('2.1 Respeta techos estrictos (< 70, < 120, < 110 líneas), cableado onChangeSize, min-h-[44px], estado activo blanco y 0 CRLF', () => {
      assert.ok(modalRaw.trim().split('\n').length < 70, `EditSaleModal.jsx debe tener < 70 líneas (${modalRaw.trim().split('\n').length})`);
      assert.ok(hookRaw.trim().split('\n').length < 120, `useEditSaleForm.js debe tener < 120 líneas (${hookRaw.trim().split('\n').length})`);
      assert.ok(tableRaw.trim().split('\n').length < 110, `EditSaleItemsTable.jsx debe tener < 110 líneas (${tableRaw.trim().split('\n').length})`);

      assert.ok(hookRaw.includes('const handleChangeSize = (idx, newSize) =>'));
      assert.ok(modalRaw.includes('onChangeSize={handleChangeSize}'));
      assert.ok(tableRaw.includes('edit-size-btn-'));
      assert.ok(tableRaw.includes('onChangeSize(idx, sz)'));
      assert.ok(tableRaw.includes('bg-white text-black'));

      for (const [name, content] of [['EditSaleModal.jsx', modalRaw], ['useEditSaleForm.js', hookRaw], ['EditSaleItemsTable.jsx', tableRaw]]) {
        assert.equal(content.includes('\r\n'), false, `${name} debe tener 0 CRLF`);
        assert.ok(!/amber-|orange-/.test(content), `${name} no debe usar clases amber-* u orange-*`);
      }
    });
  });

  describe('3. Backend Transaccional (saleUpdateService.js & saleKpiService.js)', () => {
    it('3.1 Proyecta sizes: true en product, actualiza talla/precio/pago atómicamente preservando productId y customImageUrl, y bloquea precios adulterados', async () => {
      const kpiSrc = fs.readFileSync(path.join(ROOT, 'server/services/sales/saleKpiService.js'), 'utf8');
      const updSrc = fs.readFileSync(path.join(ROOT, 'server/services/sales/saleUpdateService.js'), 'utf8');
      assert.ok(kpiSrc.includes('sizes: true'), 'getEventSalesList debe incluir sizes: true en product');
      assert.ok(updSrc.includes('sizes: true'), 'updateSaleTransaction debe incluir sizes: true en product');

      let updatedItemData = null;
      let updatedSaleData = null;
      let recreatedPayments = null;

      const mockTx = {
        sale: {
          findFirst: async () => ({
            id: 'sale-size-edit-1',
            saleNumber: 'FERI-0242',
            tenantId: 'tenant-deko',
            sellerId: 'seller-1',
            eventId: 'evt-feria-1',
            orderType: 'POS_FERIA',
            status: 'COMPLETADA',
            totalAmount: 130,
            discount: 0,
            shippingCost: 0,
            commissionPaid: false,
            commissionSettlementId: null,
            createdAt: new Date(),
            items: [
              {
                id: 'item-luffy-1',
                productId: '550e8400-e29b-41d4-a716-446655440077',
                description: 'Póster Monkey D. Luffy - Recompensa 300,000,000 (Mediano)',
                quantity: 2,
                unitPrice: 65,
                subtotal: 130,
                customImageUrl: 'https://storage.googleapis.com/decovintage-master-media/posters/full/obra-mtkyegy7-4031.webp',
                productionStatus: 'PENDIENTE',
              },
            ],
            payments: [{ id: 'pay-1', method: 'EFECTIVO', amount: 130 }],
          }),
          update: async ({ data }) => {
            updatedSaleData = data;
            return { id: 'sale-size-edit-1', ...data, items: [], payments: recreatedPayments || [] };
          },
        },
        cashClosing: { findFirst: async () => null },
        saleItem: {
          update: async ({ data }) => { updatedItemData = data; return data; },
          deleteMany: async () => ({ count: 0 }),
        },
        salePayment: {
          deleteMany: async () => ({ count: 1 }),
          createMany: async ({ data }) => { recreatedPayments = data; return { count: data.length }; },
        },
        auditLog: { create: async () => ({}) },
      };

      const origTx = prisma.$transaction;
      prisma.$transaction = async (fn) => fn(mockTx);
      try {
        // Cambio de Mediano (Q65 x 2 = Q130) -> Grande (Q125 x 2 = Q250), incluso sin reenviar productId/customImageUrl
        await updateSaleTransaction({
          saleId: 'sale-size-edit-1',
          tenantId: 'tenant-deko',
          userId: 'seller-1',
          userRoles: ['VENDEDOR'],
          assignedEventId: 'evt-feria-1',
          items: [
            {
              id: 'item-luffy-1',
              description: 'Póster Monkey D. Luffy - Recompensa 300,000,000 (Grande)',
              quantity: 2,
              unitPrice: 125,
            },
          ],
          payments: [{ method: 'TARJETA', amount: 250 }],
          discount: 0,
        });

        assert.equal(updatedItemData.description, 'Póster Monkey D. Luffy - Recompensa 300,000,000 (Grande)');
        assert.equal(updatedItemData.unitPrice, 125);
        assert.equal(updatedItemData.subtotal, 250);
        assert.equal(updatedItemData.productId, '550e8400-e29b-41d4-a716-446655440077', 'Debe conservar productId cuando solo cambió la talla');
        assert.equal(updatedItemData.customImageUrl, 'https://storage.googleapis.com/decovintage-master-media/posters/full/obra-mtkyegy7-4031.webp');
        assert.equal(updatedSaleData.totalAmount, 250);
        assert.equal(recreatedPayments[0].amount, 250);
        assert.equal(recreatedPayments[0].method, 'TARJETA');

        // Precio inválido para talla Grande (envía Q65 diciendo Grande) -> HTTP 400
        await assert.rejects(
          () => updateSaleTransaction({
            saleId: 'sale-size-edit-1',
            tenantId: 'tenant-deko',
            userId: 'seller-1',
            userRoles: ['VENDEDOR'],
            assignedEventId: 'evt-feria-1',
            items: [{ id: 'item-luffy-1', description: 'Póster Monkey D. Luffy (Grande)', quantity: 1, unitPrice: 65 }],
            payments: [{ method: 'EFECTIVO', amount: 65 }],
          }),
          (err) => err.statusCode === 400
        );
      } finally {
        prisma.$transaction = origTx;
      }
    });
  });
});
