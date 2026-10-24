import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../server/config/prisma.js';
import { updateSaleTransaction } from '../../server/services/sales/saleUpdateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ SURGERY-064: UI/UX CONSOLIDATION, POSTER DESIGN SWAP IN EDIT SALE & WHITE PAYMENT SELECTORS', () => {

  // =========================================================================
  // SUITE 1: CATALOGSEARCHINPUT.JSX SUPPRESSION OF "DESDE Q25"
  // =========================================================================
  describe('1. CatalogSearchInput.jsx Clean Dropdown (No "Desde Q25" Noise)', () => {
    const searchPath = path.join(rootDir, 'src/components/manual-sale/CatalogSearchInput.jsx');
    const content = fs.readFileSync(searchPath, 'utf-8');

    it('1.1 CatalogSearchInput.jsx does NOT render "Desde" or poster.precioMinimo badge in dropdown', () => {
      assert.ok(
        !content.includes('>Desde<'),
        'CatalogSearchInput.jsx must NOT contain ">Desde<" badge'
      );
      assert.ok(
        !content.includes('poster.precioMinimo'),
        'CatalogSearchInput.jsx must NOT render poster.precioMinimo in dropdown'
      );
    });
  });

  // =========================================================================
  // SUITE 2: FASTMANUALSALEFORM.JSX MODE TOGGLE LABELS
  // =========================================================================
  describe('2. FastManualSaleForm.jsx Segmented Control Labels', () => {
    const formPath = path.join(rootDir, 'src/components/FastManualSaleForm.jsx');
    const content = fs.readFileSync(formPath, 'utf-8');

    it('2.1 Uses "Venta Directa en Stand" and "Ventas de Redes Sociales" in mode toggle buttons', () => {
      assert.ok(
        content.includes('<span>Venta Directa en Stand</span>'),
        'Must display <span>Venta Directa en Stand</span>'
      );
      assert.ok(
        content.includes('<span>Ventas de Redes Sociales</span>'),
        'Must display <span>Ventas de Redes Sociales</span>'
      );
      assert.ok(
        !content.includes('<span>Mostrador (Feria 100%)</span>'),
        'Must NOT display old label Mostrador (Feria 100%)'
      );
      assert.ok(
        !content.includes('<span>Redes / 50-50 (WhatsApp)</span>'),
        'Must NOT display old label Redes / 50-50 (WhatsApp)'
      );
      assert.ok(
        content.includes('MODO MOSTRADOR (FERIA 100%)'),
        'Must preserve section comment MODO MOSTRADOR (FERIA 100%) for backward compatibility'
      );
    });
  });

  // =========================================================================
  // SUITE 3: WHITE ACTIVE STATE FOR PAYMENT METHOD SELECTORS ACROSS ALL ROLES
  // =========================================================================
  describe('3. White Active State for Payment Method Selectors Across All Components', () => {
    const paymentBarPath = path.join(rootDir, 'src/components/manual-sale/PaymentSummaryBar.jsx');
    const editModalPath = path.join(rootDir, 'src/components/EditSaleModal.jsx');
    const balanceModalPath = path.join(rootDir, 'src/components/sales/BalancePaymentModal.jsx');

    it('3.1 PaymentSummaryBar.jsx uses white active state (bg-white text-black border-white) and no amber-400 active button', () => {
      const content = fs.readFileSync(paymentBarPath, 'utf-8');
      assert.ok(
        content.includes('bg-white text-black border-white shadow-sm font-bold'),
        'PaymentSummaryBar.jsx must use bg-white text-black border-white shadow-sm font-bold'
      );
      assert.ok(
        !content.includes('bg-amber-400 text-black border-amber-400'),
        'PaymentSummaryBar.jsx must NOT use bg-amber-400 text-black border-amber-400'
      );
    });

    it('3.2 EditSaleModal.jsx uses white active state (bg-white text-black border-white) and min-h-[44px] on payment methods', () => {
      const content = fs.readFileSync(editModalPath, 'utf-8');
      assert.ok(
        content.includes('bg-white text-black border-white shadow-sm font-bold'),
        'EditSaleModal.jsx must use bg-white text-black border-white shadow-sm font-bold'
      );
      assert.ok(
        !content.includes('bg-amber-400 text-black border-amber-400'),
        'EditSaleModal.jsx must NOT use bg-amber-400 text-black border-amber-400'
      );
    });

    it('3.3 BalancePaymentModal.jsx uses white active state for both primary and split payment methods', () => {
      const content = fs.readFileSync(balanceModalPath, 'utf-8');
      const whiteMatches = (content.match(/bg-white text-black border-white shadow-sm font-bold/g) || []).length;
      assert.ok(
        whiteMatches >= 2,
        'BalancePaymentModal.jsx must use bg-white text-black border-white shadow-sm font-bold for both method and splitMethod2'
      );
      assert.ok(
        !content.includes('bg-amber-400 text-black border-amber-400'),
        'BalancePaymentModal.jsx must NOT use bg-amber-400 text-black border-amber-400'
      );
    });
  });

  // =========================================================================
  // SUITE 4: EDITSALEMODAL.JSX & EDITSALEITEMSTABLE.JSX 2-TIER LAYOUT & DESIGN SWAP
  // =========================================================================
  describe('4. EditSaleModal & EditSaleItemsTable Layout, Whitespace-Nowrap & Poster Design Replacement', () => {
    const editModalPath = path.join(rootDir, 'src/components/EditSaleModal.jsx');
    const editTablePath = path.join(rootDir, 'src/components/sales/edit/EditSaleItemsTable.jsx');
    const editHookPath = path.join(rootDir, 'src/components/sales/edit/hooks/useEditSaleForm.js');

    it('4.1 EditSaleItemsTable.jsx implements 2-tier card layout, whitespace-nowrap on amounts, and Cambiar diseño control', () => {
      const content = fs.readFileSync(editTablePath, 'utf-8');
      assert.ok(
        content.includes('onReplaceItem'),
        'EditSaleItemsTable must accept and invoke onReplaceItem'
      );
      assert.ok(
        content.includes('Cambiar diseño'),
        'EditSaleItemsTable must render "Cambiar diseño" button'
      );
      assert.ok(
        content.includes('whitespace-nowrap'),
        'EditSaleItemsTable must apply whitespace-nowrap to prevent Q from splitting from numeric value'
      );
      assert.ok(
        content.includes('Precio unitario: Q {Number(it.unitPrice).toFixed(2)}'),
        'EditSaleItemsTable must display unit price cleanly'
      );
    });

    it('4.2 EditSaleModal.jsx separates Total Recalculado bar from uniform 3-column action buttons with whitespace-nowrap', () => {
      const content = fs.readFileSync(editModalPath, 'utf-8');
      assert.ok(
        content.includes('onReplaceItem={handleReplaceItem}'),
        'EditSaleModal must wire onReplaceItem={handleReplaceItem} to EditSaleItemsTable'
      );
      assert.ok(
        content.includes('whitespace-nowrap">Q {grandTotal.toFixed(2)}'),
        'Total Recalculado must keep Q and amount together with whitespace-nowrap'
      );
      assert.ok(
        content.includes('sm:grid-cols-3'),
        'Action buttons must be arranged in a uniform responsive grid (sm:grid-cols-3)'
      );
    });

    it('4.3 useEditSaleForm.js defines immutable handleReplaceItem preserving item size and updating image/description', () => {
      const content = fs.readFileSync(editHookPath, 'utf-8');
      assert.ok(
        content.includes('const handleReplaceItem = (idx, newPoster) =>'),
        'useEditSaleForm must define handleReplaceItem'
      );
      assert.ok(
        content.includes('handleReplaceItem,'),
        'useEditSaleForm must return handleReplaceItem'
      );
      assert.ok(
        content.includes('customImageUrl: nextImg'),
        'handleReplaceItem must update customImageUrl with new poster image'
      );
    });

    it('4.4 Backend saleUpdateService.js clears stale existingItem.productId when poster design is replaced by a web catalog poster', async () => {
      let updatedSaleItemData = null;

      const mockTx = {
        sale: {
          findFirst: async () => ({
            id: 'sale-edit-064',
            saleNumber: 'S-064',
            tenantId: 'tenant-deko',
            sellerId: 'seller-1',
            eventId: 'evt-1',
            orderType: 'POS_FERIA',
            status: 'COMPLETADA',
            totalAmount: 35,
            discount: 0,
            shippingCost: 0,
            commissionPaid: false,
            commissionSettlementId: null,
            createdAt: new Date(),
            items: [
              {
                id: 'item-existing-1',
                productId: 'old-uuid-product-1111',
                description: 'Póster Spider-Man (Pequeño)',
                quantity: 1,
                unitPrice: 35,
                subtotal: 35,
                customImageUrl: 'https://old-image.jpg',
                productionStatus: 'PENDIENTE',
              },
            ],
            payments: [{ id: 'pay-1', method: 'EFECTIVO', amount: 35 }],
          }),
          update: async ({ data }) => ({
            id: 'sale-edit-064',
            ...data,
            items: [],
            payments: [{ method: 'EFECTIVO', amount: 35 }],
          }),
        },
        cashClosing: {
          findFirst: async () => null,
        },
        saleItem: {
          update: async ({ data }) => {
            updatedSaleItemData = data;
            return data;
          },
          deleteMany: async () => ({ count: 0 }),
        },
        salePayment: {
          deleteMany: async () => ({ count: 1 }),
          createMany: async () => ({ count: 1 }),
        },
        auditLog: {
          create: async () => ({}),
        },
      };

      const origTransaction = prisma.$transaction;
      prisma.$transaction = async (fn) => fn(mockTx);

      try {
        await updateSaleTransaction({
          saleId: 'sale-edit-064',
          tenantId: 'tenant-deko',
          userId: 'seller-1',
          userRoles: ['SUPER_ADMIN'],
          items: [
            {
              id: 'item-existing-1',
              productId: null, // Web catalog poster without local UUID product row
              description: 'Póster Batman Dark Knight (Pequeño)',
              quantity: 1,
              unitPrice: 35,
              customImageUrl: 'https://new-batman-image.jpg',
            },
          ],
          payments: [{ method: 'EFECTIVO', amount: 35 }],
          discount: 0,
          notes: 'Cambio de diseño solicitado por cliente',
        });

        assert.ok(updatedSaleItemData, 'tx.saleItem.update must have been called');
        assert.equal(
          updatedSaleItemData.description,
          'Póster Batman Dark Knight (Pequeño)',
          'Description must be updated to the new poster'
        );
        assert.equal(
          updatedSaleItemData.productId,
          null,
          'productId must be null (NOT stale old-uuid-product-1111) when design changed and new poster has no local UUID'
        );
        assert.equal(
          updatedSaleItemData.customImageUrl,
          'https://new-batman-image.jpg',
          'customImageUrl must be updated to the new poster image'
        );
      } finally {
        prisma.$transaction = origTransaction;
      }
    });
  });
});
