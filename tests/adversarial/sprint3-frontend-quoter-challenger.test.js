import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createRemoteSaleSchema,
  remoteSaleItemSchema,
  customerSchema,
} from '../../server/validators/remoteSaleValidators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

/**
 * Mirror of the mathematical engine implemented in useRemoteSaleForm.js
 */
function calculateRemoteQuoterMath({ cartItems = [], discount = 0, deliveryMethod = 'ENVIO_COURIER', shippingCost = 35, depositInput = '' }) {
  const productsSubtotal = cartItems.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
  const productsAmount = Math.max(0, Number((productsSubtotal - (Number(discount) || 0)).toFixed(2)));
  const effectiveShippingCost = deliveryMethod === 'ENVIO_COURIER' ? Number(shippingCost || 0) : 0;
  const totalAmount = Number((productsAmount + effectiveShippingCost).toFixed(2));
  const minDeposit = Number((totalAmount * 0.50).toFixed(2));
  const numericDeposit = Number(depositInput) || 0;
  const balanceDue = Math.max(0, Number((totalAmount - numericDeposit).toFixed(2)));
  const isDepositValid = totalAmount > 0 && numericDeposit >= minDeposit;
  const isInsufficient = totalAmount > 0 && numericDeposit < minDeposit;
  const isPaidTotal = totalAmount > 0 && numericDeposit >= totalAmount;

  return {
    productsSubtotal,
    productsAmount,
    effectiveShippingCost,
    totalAmount,
    minDeposit,
    numericDeposit,
    balanceDue,
    isDepositValid,
    isInsufficient,
    isPaidTotal,
  };
}

/**
 * Mirror of addCustomItem generator from useRemoteSaleForm.js
 */
function createCustomItem({ description, unitPrice, quantity = 1, material = 'MDF_5_5MM', customDimensions = '30x40 cm', customImageUrl = null }) {
  const qty = Number(quantity) || 1;
  const price = Number(unitPrice) || 0;
  return {
    id: `custom-test-${Math.random().toString(36).substring(2, 8)}`,
    productId: null,
    description: `Personalizado: ${description.trim()} (${material}, ${customDimensions})`,
    unitPrice: price,
    quantity: qty,
    subtotal: Number((qty * price).toFixed(2)),
    isCustom: true,
    material,
    customDimensions,
    customImageUrl,
    availableSizes: [{ sizeId: 'CUSTOM', nombre: customDimensions || 'Personalizado', precio: price }],
    selectedSizeId: 'CUSTOM',
  };
}

/**
 * Mirror of payload items mapper from useRemoteSaleForm.js
 */
function mapCartItemsToPayload(cartItems) {
  return cartItems.map((it) => ({
    productId: it.productId || null,
    description: it.description,
    quantity: it.quantity,
    unitPrice: Number(it.unitPrice),
    isCustom: Boolean(it.isCustom),
    material: it.material || null,
    customDimensions: it.customDimensions || null,
    customImageUrl: it.customImageUrl || null,
  }));
}

describe('⚔️ SPRINT 3 CHALLENGER: Frontend Quoter & Business Logic Stress Harness', () => {

  // =========================================================================
  // CATEGORY 1: MATHEMATICAL COMBINATIONS & SHIPPING CALCULATIONS
  // =========================================================================
  describe('1. Mathematical Combinations & Shipping Rates', () => {
    it('1.1 Items only without courier shipping (PUNTO_VENTA / RETIRO_EVENTO): shipping = Q0.00', () => {
      const cartItems = [
        { subtotal: 65.00 }, // 1 Mediano
        { subtotal: 35.00 }, // 1 Pequeño
      ];

      const resPuntoVenta = calculateRemoteQuoterMath({
        cartItems,
        deliveryMethod: 'PUNTO_VENTA',
        shippingCost: 35, // even if passed, must be zeroed out
      });

      assert.equal(resPuntoVenta.productsSubtotal, 100.00);
      assert.equal(resPuntoVenta.productsAmount, 100.00);
      assert.equal(resPuntoVenta.effectiveShippingCost, 0.00);
      assert.equal(resPuntoVenta.totalAmount, 100.00);
      assert.equal(resPuntoVenta.minDeposit, 50.00);

      const resRetiro = calculateRemoteQuoterMath({
        cartItems,
        deliveryMethod: 'RETIRO_EVENTO',
        shippingCost: 40,
      });

      assert.equal(resRetiro.effectiveShippingCost, 0.00);
      assert.equal(resRetiro.totalAmount, 100.00);
      assert.equal(resRetiro.minDeposit, 50.00);
    });

    it('1.2 Items + Courier Shipping Q35 (Standard Capital rate)', () => {
      const itemsMap = [
        { name: '1 Portada Álbum', price: 55, expectedTotal: 90.00, expectedDeposit: 45.00 },
        { name: '1 Mediano', price: 65, expectedTotal: 100.00, expectedDeposit: 50.00 },
        { name: '1 Grande', price: 125, expectedTotal: 160.00, expectedDeposit: 80.00 },
        { name: '1 Gigante', price: 180, expectedTotal: 215.00, expectedDeposit: 107.50 },
      ];

      for (const item of itemsMap) {
        const res = calculateRemoteQuoterMath({
          cartItems: [{ subtotal: item.price }],
          deliveryMethod: 'ENVIO_COURIER',
          shippingCost: 35,
        });

        assert.equal(res.productsSubtotal, item.price);
        assert.equal(res.effectiveShippingCost, 35.00);
        assert.equal(res.totalAmount, item.expectedTotal, `Failed total for ${item.name}`);
        assert.equal(res.minDeposit, item.expectedDeposit, `Failed 50% deposit for ${item.name}`);
      }
    });

    it('1.3 Items + Courier Shipping Q40 (Departamentos rate)', () => {
      const itemsMap = [
        { name: '1 Pequeño', price: 35, expectedTotal: 75.00, expectedDeposit: 37.50 },
        { name: '1 Mediano', price: 65, expectedTotal: 105.00, expectedDeposit: 52.50 },
        { name: '2 Medianos', price: 130, expectedTotal: 170.00, expectedDeposit: 85.00 },
        { name: '1 Custom Poster Q75', price: 75, expectedTotal: 115.00, expectedDeposit: 57.50 },
      ];

      for (const item of itemsMap) {
        const res = calculateRemoteQuoterMath({
          cartItems: [{ subtotal: item.price }],
          deliveryMethod: 'ENVIO_COURIER',
          shippingCost: 40,
        });

        assert.equal(res.productsSubtotal, item.price);
        assert.equal(res.effectiveShippingCost, 40.00);
        assert.equal(res.totalAmount, item.expectedTotal, `Failed total for ${item.name}`);
        assert.equal(res.minDeposit, item.expectedDeposit, `Failed 50% deposit for ${item.name}`);
      }
    });

    it('1.4 Discounts applied to products and never inflating or corrupting shipping', () => {
      // Scenario A: Standard discount
      const resA = calculateRemoteQuoterMath({
        cartItems: [{ subtotal: 130.00 }],
        discount: 15.00,
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35.00,
      });

      assert.equal(resA.productsSubtotal, 130.00);
      assert.equal(resA.productsAmount, 115.00);
      assert.equal(resA.effectiveShippingCost, 35.00);
      assert.equal(resA.totalAmount, 150.00);
      assert.equal(resA.minDeposit, 75.00);

      // Scenario B: Aggressive discount exceeding products subtotal
      const resB = calculateRemoteQuoterMath({
        cartItems: [{ subtotal: 40.00 }],
        discount: 100.00,
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35.00,
      });

      // Products amount cannot go negative (Math.max(0, ...))
      assert.equal(resB.productsAmount, 0.00);
      // Total amount is only the shipping cost
      assert.equal(resB.totalAmount, 35.00);
      assert.equal(resB.minDeposit, 17.50);
    });
  });

  // =========================================================================
  // CATEGORY 2: ROUNDING OF 50% MINIMUM DEPOSIT & FRACTIONAL CENTS
  // =========================================================================
  describe('2. Rounding of 50% Minimum Deposit & Fractional Cent Precision', () => {
    it('2.1 Authoritative specification case: Q35.00 total yields strictly Q17.50 minimum deposit', () => {
      const res = calculateRemoteQuoterMath({
        cartItems: [{ subtotal: 35.00 }],
        deliveryMethod: 'PUNTO_VENTA',
        shippingCost: 0,
      });

      assert.equal(res.totalAmount, 35.00);
      assert.equal(res.minDeposit, 17.50, 'Q35.00 total must yield exactly Q17.50 min deposit');
    });

    it('2.2 Odd totals and decimal cent rounding boundaries', () => {
      const testCases = [
        { total: 15.00, expectedMin: 7.50 },
        { total: 25.00, expectedMin: 12.50 },
        { total: 35.00, expectedMin: 17.50 },
        { total: 55.00, expectedMin: 27.50 },
        { total: 65.00, expectedMin: 32.50 },
        { total: 75.00, expectedMin: 37.50 },
        { total: 105.00, expectedMin: 52.50 },
        { total: 125.00, expectedMin: 62.50 },
        { total: 145.00, expectedMin: 72.50 },
        { total: 175.00, expectedMin: 87.50 },
        { total: 185.00, expectedMin: 92.50 },
      ];

      for (const tc of testCases) {
        const res = calculateRemoteQuoterMath({
          cartItems: [{ subtotal: tc.total }],
          deliveryMethod: 'PUNTO_VENTA',
        });
        assert.equal(res.totalAmount, tc.total);
        assert.equal(res.minDeposit, tc.expectedMin, `Failed for total Q${tc.total}`);
      }
    });

    it('2.3 Property sweep: 250 price permutations guarantee minDeposit * 2 === totalAmount within 0.01 precision', () => {
      for (let price = 5; price <= 500; price += 2) {
        const shipping = (price % 3 === 0) ? 35 : (price % 3 === 1) ? 40 : 0;
        const discount = (price > 100) ? 10 : 0;

        const res = calculateRemoteQuoterMath({
          cartItems: [{ subtotal: price }],
          discount,
          deliveryMethod: shipping > 0 ? 'ENVIO_COURIER' : 'PUNTO_VENTA',
          shippingCost: shipping,
          depositInput: '0',
        });

        const expectedTotal = Number((price - discount + shipping).toFixed(2));
        assert.equal(res.totalAmount, expectedTotal);

        const doubledMin = Number((res.minDeposit * 2).toFixed(2));
        const diff = Math.abs(doubledMin - res.totalAmount);
        assert.ok(diff <= 0.01, `Min deposit rounding drifted beyond 1 cent on price ${price}: diff=${diff}`);

        // Balance due with min deposit paid must exactly reconcile
        const resWithMin = calculateRemoteQuoterMath({
          cartItems: [{ subtotal: price }],
          discount,
          deliveryMethod: shipping > 0 ? 'ENVIO_COURIER' : 'PUNTO_VENTA',
          shippingCost: shipping,
          depositInput: res.minDeposit.toString(),
        });

        const sumReconciliation = Number((resWithMin.numericDeposit + resWithMin.balanceDue).toFixed(2));
        assert.equal(sumReconciliation, res.totalAmount, `Reconciliation failed on price ${price}`);
      }
    });
  });

  // =========================================================================
  // CATEGORY 3: PREVENTIVE STOP & SUBMIT BLOCKING LOGIC
  // =========================================================================
  describe('3. Preventive Stop & Deposit Guard Verification', () => {
    it('3.1 When deposit < minDeposit: submit is strictly blocked, isDepositValid is false, isInsufficient is true', () => {
      const testCases = [
        { total: 100.00, minDeposit: 50.00, depositInput: '0' },
        { total: 100.00, minDeposit: 50.00, depositInput: '49.99' },
        { total: 100.00, minDeposit: 50.00, depositInput: '25.00' },
        { total: 170.00, minDeposit: 85.00, depositInput: '84.99' },
        { total: 35.00, minDeposit: 17.50, depositInput: '17.49' },
      ];

      for (const tc of testCases) {
        const res = calculateRemoteQuoterMath({
          cartItems: [{ subtotal: tc.total }],
          deliveryMethod: 'PUNTO_VENTA',
          depositInput: tc.depositInput,
        });

        assert.equal(res.isDepositValid, false, `isDepositValid must be FALSE when deposit ${tc.depositInput} < min ${tc.minDeposit}`);
        assert.equal(res.isInsufficient, true, `isInsufficient must be TRUE when deposit ${tc.depositInput} < min ${tc.minDeposit}`);
        assert.equal(res.isPaidTotal, false);
        assert.ok(res.balanceDue > 0, 'balanceDue must be positive');
      }
    });

    it('3.2 When deposit >= minDeposit: submit is permitted, isDepositValid is true, isInsufficient is false', () => {
      // Case A: Exact 50% minimum deposit
      const res50 = calculateRemoteQuoterMath({
        cartItems: [{ subtotal: 100.00 }],
        deliveryMethod: 'PUNTO_VENTA',
        depositInput: '50.00',
      });

      assert.equal(res50.isDepositValid, true, 'isDepositValid must be TRUE for exact 50% deposit');
      assert.equal(res50.isInsufficient, false);
      assert.equal(res50.isPaidTotal, false);
      assert.equal(res50.balanceDue, 50.00);

      // Case B: Partial deposit between 50% and 100% (e.g. Q75 on Q100)
      const res75 = calculateRemoteQuoterMath({
        cartItems: [{ subtotal: 100.00 }],
        deliveryMethod: 'PUNTO_VENTA',
        depositInput: '75.00',
      });

      assert.equal(res75.isDepositValid, true);
      assert.equal(res75.isInsufficient, false);
      assert.equal(res75.isPaidTotal, false);
      assert.equal(res75.balanceDue, 25.00);

      // Case C: 100% Full Payment
      const res100 = calculateRemoteQuoterMath({
        cartItems: [{ subtotal: 100.00 }],
        deliveryMethod: 'PUNTO_VENTA',
        depositInput: '100.00',
      });

      assert.equal(res100.isDepositValid, true);
      assert.equal(res100.isInsufficient, false);
      assert.equal(res100.isPaidTotal, true);
      assert.equal(res100.balanceDue, 0.00);
    });

    it('3.3 Empty cart (totalAmount === 0): submit is strictly blocked even if deposit is entered', () => {
      const res = calculateRemoteQuoterMath({
        cartItems: [],
        deliveryMethod: 'PUNTO_VENTA',
        depositInput: '50.00',
      });

      assert.equal(res.totalAmount, 0.00);
      assert.equal(res.isDepositValid, false, 'isDepositValid must be false when total is 0');
    });

    it('3.4 RemoteQuoterSummary component code enforces disabled state when !isDepositValid', () => {
      const summaryPath = path.join(rootDir, 'src/components/manual-sale/RemoteQuoterSummary.jsx');
      assert.ok(fs.existsSync(summaryPath), 'RemoteQuoterSummary.jsx must exist');
      const content = fs.readFileSync(summaryPath, 'utf-8');

      // Assert disabled condition on button
      assert.ok(
        content.includes('disabled={!isDepositValid || isSubmitting}'),
        'Submit button in RemoteQuoterSummary must have disabled={!isDepositValid || isSubmitting}'
      );

      // Assert visual classes disabling pointer events
        assert.ok(
        content.includes('pointer-events-none'),
        'Submit button must include pointer-events-none when invalid'
      );

      // Assert amber warning presence
      assert.ok(
        content.includes('isInsufficient &&'),
        'RemoteQuoterSummary must render amber warning block when isInsufficient is true'
      );
    });

    it('3.5 useRemoteSaleForm.js confirmRemoteSale contains pre-flight abort guard on insufficient deposit', () => {
      const hookPath = path.join(rootDir, 'src/components/manual-sale/hooks/useRemoteSaleForm.js');
      const content = fs.readFileSync(hookPath, 'utf-8');

      // Look for the guard in confirmRemoteSale
      const guardPattern = /if\s*\(\s*numericDeposit\s*<\s*minDeposit\s*\)\s*\{[\s\S]*?setSubmitError\([\s\S]*?return\s+false;?\s*\}/;
      assert.ok(guardPattern.test(content), 'confirmRemoteSale must contain strict pre-flight guard returning false if numericDeposit < minDeposit');
    });
  });

  // =========================================================================
  // CATEGORY 4: CUSTOM ITEM STRUCTURE & BACKEND VALIDATOR INTEGRATION
  // =========================================================================
  describe('4. Custom Item Structure & Backend Validator Compatibility', () => {
    it('4.1 Custom item generated by addCustomItem contains all required fields', () => {
      const custom = createCustomItem({
        description: 'Retrato Goku Ultra Instinto',
        material: 'MDF_5_5MM',
        customDimensions: '50x70 cm',
        unitPrice: 120,
        quantity: 2,
        customImageUrl: 'https://images.unsplash.com/photo-custom-art-123',
      });

      assert.equal(custom.isCustom, true);
      assert.equal(custom.material, 'MDF_5_5MM');
      assert.equal(custom.customDimensions, '50x70 cm');
      assert.equal(custom.unitPrice, 120);
      assert.equal(custom.quantity, 2);
      assert.equal(custom.subtotal, 240.00);
      assert.equal(custom.customImageUrl, 'https://images.unsplash.com/photo-custom-art-123');
      assert.ok(custom.description.includes('Goku Ultra Instinto'));
      assert.ok(custom.description.includes('MDF_5_5MM'));
    });

    it('4.2 Mapped custom item passes remoteSaleItemSchema validation from server/validators', () => {
      const materials = ['MDF_5_5MM', 'PVC_5MM', 'VINILO_SOLO'];

      for (const mat of materials) {
        const custom = createCustomItem({
          description: `Cuadro Test ${mat}`,
          material: mat,
          customDimensions: '30x40 cm',
          unitPrice: 75,
          quantity: 1,
          customImageUrl: 'https://dekovintage.online/ref.jpg',
        });

        const mappedPayloadItems = mapCartItemsToPayload([custom]);
        const parsed = remoteSaleItemSchema.safeParse(mappedPayloadItems[0]);

        assert.ok(parsed.success, `Custom item with material ${mat} failed Zod validation: ${JSON.stringify(parsed.error?.format())}`);
        assert.equal(parsed.data.isCustom, true);
        assert.equal(parsed.data.material, mat);
        assert.equal(parsed.data.customDimensions, '30x40 cm');
        assert.equal(parsed.data.unitPrice, 75);
      }
    });

    it('4.3 Full remote sale payload containing custom item passes createRemoteSaleSchema', () => {
      const custom = createCustomItem({
        description: 'Retrato Familiar Anime',
        material: 'PVC_5MM',
        customDimensions: '40x60 cm',
        unitPrice: 95.00,
        quantity: 1,
        customImageUrl: 'https://storage.googleapis.com/deko-assets/sample.png',
      });

      const fullPayload = {
        eventId: 'evt-ventas-redes-online',
        customer: {
          fullName: 'Carlos Mendoza',
          phone: '50241234567',
          email: 'carlos@example.com',
          deliveryAddress: '15 Avenida 10-25 Zona 10',
          department: 'Guatemala',
          municipality: 'Guatemala',
          sourceChannel: 'WHATSAPP',
          notes: 'Entregar en garita',
        },
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35.00,
        shippingCourier: 'GUATEX',
        shippingTrackingNumber: 'GTX-987654',
        items: mapCartItemsToPayload([custom]),
        payments: [
          {
            method: 'TRANSFERENCIA',
            amount: 65.00, // 95 + 35 = 130 total; min deposit = 65.00 (50%)
            reference: 'TRANSF-2026-001',
          },
        ],
        discount: 0,
        notes: 'Cliente de Instagram',
        idempotencyKey: 'test-idemp-uuid-12345',
      };

      const result = createRemoteSaleSchema.safeParse(fullPayload);
      assert.ok(result.success, `Full payload failed createRemoteSaleSchema: ${JSON.stringify(result.error?.format())}`);
    });
  });

  // =========================================================================
  // CATEGORY 5: ARCHITECTURAL LINE CEILINGS & ERGONOMICS >= 44PX
  // =========================================================================
  describe('5. Architectural Line Ceilings & Touch Ergonomics >= 44px', () => {
    const componentCeilings = [
      { path: 'src/components/manual-sale/hooks/useRemoteSaleForm.js', max: 350, type: 'hook' },
      { path: 'src/components/manual-sale/RemoteQuoterSummary.jsx', max: 280, type: 'ui' },
      { path: 'src/components/manual-sale/CustomItemModal.jsx', max: 280, type: 'ui' },
      { path: 'src/components/manual-sale/DeliveryMethodSelector.jsx', max: 280, type: 'ui' },
      { path: 'src/components/manual-sale/CustomerWhatsAppSearch.jsx', max: 280, type: 'ui' },
      { path: 'src/components/manual-sale/WhatsAppQuoteShareModal.jsx', max: 280, type: 'ui' },
      { path: 'src/components/FastManualSaleForm.jsx', max: 280, type: 'ui' },
      { path: 'src/components/sales/BalancePaymentModal.jsx', max: 280, type: 'ui' },
      { path: 'src/components/sales/RecentSaleRow.jsx', max: 280, type: 'ui' },
    ];

    for (const comp of componentCeilings) {
      it(`5.1 File ${path.basename(comp.path)} must be <= ${comp.max} lines (${comp.type})`, () => {
        const fullPath = path.join(rootDir, comp.path);
        assert.ok(fs.existsSync(fullPath), `${comp.path} must exist`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').length;
        assert.ok(
          lines <= comp.max,
          `Ceiling violation: ${comp.path} has ${lines} lines, exceeding maximum of ${comp.max}`
        );
      });
    }

    it('5.2 Touch Ergonomics in RemoteQuoterSummary: quick 50% & 100% buttons, input, and submit have min-h-[44px]', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/manual-sale/RemoteQuoterSummary.jsx'), 'utf-8');
      assert.ok(content.includes('min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold'), 'Quick buttons must enforce min-h-[44px]');
      assert.ok(content.includes('w-full min-h-[44px] px-3.5 py-2.5'), 'Numeric deposit input must enforce min-h-[44px]');
      assert.ok(content.includes('w-full min-h-[48px] px-6 py-3.5 rounded-2xl'), 'Primary CTA button must enforce min-h-[48px]');
    });

    it('5.3 Touch Ergonomics in DeliveryMethodSelector: method options and courier rate buttons have min-h-[44px]', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/manual-sale/DeliveryMethodSelector.jsx'), 'utf-8');
      assert.ok(content.includes('min-h-[44px]'), 'DeliveryMethodSelector must enforce min-h-[44px]');
    });

    it('5.4 Touch Ergonomics in CustomItemModal: material, dimension, and submit buttons have min-h-[44px]', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/manual-sale/CustomItemModal.jsx'), 'utf-8');
      assert.ok(content.includes('min-h-[44px]'), 'CustomItemModal must enforce min-h-[44px] on interactive elements');
    });
  });
});
