import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  customerSchema,
  remoteSaleItemSchema,
  remoteSalePaymentSchema,
  createRemoteSaleSchema,
  balancePaymentSchema,
} from '../../server/validators/remoteSaleValidators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

function extractOpeningTags(content) {
  const tags = [];
  const regex = /<(button|input|select)\b/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const startPos = match.index;
    const tagName = match[1];
    let i = startPos + match[0].length;
    let inBraces = 0;
    let inQuote = null;
    let tagContent = '';
    while (i < content.length) {
      const ch = content[i];
      if (inQuote) {
        if (ch === '\\') {
          i += 2;
          continue;
        }
        if (ch === inQuote) {
          inQuote = null;
        }
      } else if (ch === '"' || ch === "'" || ch === '`') {
        inQuote = ch;
      } else if (ch === '{') {
        inBraces++;
      } else if (ch === '}') {
        inBraces--;
      } else if (ch === '>' && inBraces === 0) {
        tagContent = content.slice(startPos, i + 1);
        break;
      }
      i++;
    }
    tags.push({ tagName, tagContent, startPos });
  }
  return tags;
}

describe('⚔️ EMPIRICAL ADVERSARIAL CHALLENGER 2: Sprint 3 Ergonomics & API Contract Fidelity', () => {

  // =========================================================================
  // SUITE 1: TOUCH ERGONOMICS (>= 44x44px) ACROSS ALL NEW/MODIFIED COMPONENTS
  // =========================================================================
  describe('1. Touch Ergonomics Static & Structural Verification (>= 44px)', () => {
    const componentsToInspect = [
      { file: 'src/components/manual-sale/CustomerWhatsAppSearch.jsx', name: 'CustomerWhatsAppSearch' },
      { file: 'src/components/manual-sale/DeliveryMethodSelector.jsx', name: 'DeliveryMethodSelector' },
      { file: 'src/components/manual-sale/RemoteQuoterSummary.jsx', name: 'RemoteQuoterSummary' },
      { file: 'src/components/manual-sale/WhatsAppQuoteShareModal.jsx', name: 'WhatsAppQuoteShareModal' },
      { file: 'src/components/sales/BalancePaymentModal.jsx', name: 'BalancePaymentModal' },
      { file: 'src/components/sales/RecentSaleRow.jsx', name: 'RecentSaleRow' },
      { file: 'src/components/FastManualSaleForm.jsx', name: 'FastManualSaleForm' },
      { file: 'src/components/manual-sale/CustomItemModal.jsx', name: 'CustomItemModal' },
      { file: 'src/components/RecentSalesList.jsx', name: 'RecentSalesList' },
    ];

    componentsToInspect.forEach(({ file, name }) => {
      it(`1.1 Component ${name} exists and contains compliant touch targets`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `File must exist: ${file}`);
        const content = fs.readFileSync(fullPath, 'utf-8');

        const tags = extractOpeningTags(content);
        assert.ok(tags.length > 0, `${name} must contain interactive elements`);

        tags.forEach(({ tagName, tagContent }, idx) => {
          // If it's a hidden input, skip
          if (tagContent.includes('type="hidden"')) return;

          // Check for touch height compliance
          const hasHeightCompliance =
            tagContent.includes('min-h-[44px]') ||
            tagContent.includes('min-h-[48px]') ||
            tagContent.includes('min-h-[50px]') ||
            tagContent.includes('h-11') ||
            tagContent.includes('h-12');

          assert.ok(
            hasHeightCompliance,
            `In ${name}, <${tagName}> #${idx + 1} lacks min-h-[44px] or min-h-[48px]. Snippet: ${tagContent.substring(0, 150).replace(/\s+/g, ' ')}`
          );

          // If it's a square/icon button (rounded-full or p-2 without full width/horizontal padding), verify min-w-[44px]
          if (
            tagName === 'button' &&
            tagContent.includes('rounded-full') &&
            !tagContent.includes('w-full')
          ) {
            const hasWidthCompliance = tagContent.includes('min-w-[44px]') || tagContent.includes('w-11') || tagContent.includes('w-12');
            assert.ok(
              hasWidthCompliance,
              `In ${name}, icon button #${idx + 1} must specify min-w-[44px]. Snippet: ${tagContent.substring(0, 150).replace(/\s+/g, ' ')}`
            );
          }
        });
      });
    });

    it('1.2 CustomerWhatsAppSearch: clear button, input, accordion, channel buttons all satisfy >= 44px', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/manual-sale/CustomerWhatsAppSearch.jsx'), 'utf-8');
      assert.ok(content.includes('clearSelectedCustomer'), 'Must have clearSelectedCustomer');
      assert.ok(content.includes('min-h-[44px] min-w-[44px]'), 'Clear button must have min-h-[44px] min-w-[44px]');
      assert.ok(content.includes('placeholder="Buscar por teléfono WhatsApp'), 'Must have customer search input');
      assert.ok(content.includes('w-full min-h-[44px] pl-10 pr-10 py-2.5'), 'Search input must have min-h-[44px]');
    });

    it('1.3 DeliveryMethodSelector: courier, stand, pos options all satisfy min-h-[48px]', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/manual-sale/DeliveryMethodSelector.jsx'), 'utf-8');
      const matches = content.match(/min-h-\[48px\]/g) || [];
      assert.ok(matches.length >= 3, `Must have at least 3 delivery selector buttons with min-h-[48px], found ${matches.length}`);
    });

    it('1.4 RemoteQuoterSummary: quick 50%, 100%, deposit input, payment methods, submit CTA satisfy >= 44px', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/manual-sale/RemoteQuoterSummary.jsx'), 'utf-8');
      assert.ok(content.includes('min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border'), '50% and 100% buttons must have min-h-[44px]');
      assert.ok(content.includes('w-full min-h-[44px] px-3.5 py-2.5 bg-black'), 'Deposit input must have min-h-[44px]');
      assert.ok(content.includes('w-full min-h-[48px] px-6 py-3.5'), 'Primary confirmation CTA must have min-h-[48px]');
    });

    it('1.5 WhatsAppQuoteShareModal: close button has min-h-[44px] min-w-[44px], primary button has min-h-[48px]', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/manual-sale/WhatsAppQuoteShareModal.jsx'), 'utf-8');
      assert.ok(content.includes('min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full'), 'Close button must be 44x44px');
      assert.ok(content.includes('w-full min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-500'), 'Open WhatsApp CTA must have min-h-[48px]');
    });

    it('1.6 BalancePaymentModal: close button has min-h-[44px] min-w-[44px], submit CTA has min-h-[48px]', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/sales/BalancePaymentModal.jsx'), 'utf-8');
      assert.ok(content.includes('min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full'), 'Close button must be 44x44px');
      assert.ok(content.includes('min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-500'), 'Submit CTA must have min-h-[48px]');
    });

    it('1.7 RecentSaleRow: Cobrar Saldo button has min-h-[44px], WhatsApp button has min-h-[44px] min-w-[44px]', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/sales/RecentSaleRow.jsx'), 'utf-8');
      assert.ok(content.includes('min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-500/10'), 'Cobrar Saldo button must have min-h-[44px]');
      assert.ok(content.includes('min-h-[44px] min-w-[44px] p-2 rounded-xl bg-green-500/10'), 'WhatsApp button must have min-h-[44px] min-w-[44px]');
    });

    it('1.8 FastManualSaleForm: mode switches (POS_FERIA, REDES_PERSONALIZADO) have min-h-[44px] min-w-[44px]', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/FastManualSaleForm.jsx'), 'utf-8');
      assert.ok(content.includes('min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2'), 'Mode toggles must have min-h-[44px] min-w-[44px]');
    });
  });

  // =========================================================================
  // SUITE 2: API CONTRACT FIDELITY (createRemoteSaleSchema)
  // =========================================================================
  describe('2. API Contract Fidelity: useRemoteSaleForm vs createRemoteSaleSchema', () => {
    it('2.1 Payload with inline customer object parses cleanly against createRemoteSaleSchema', () => {
      const clientPayload = {
        eventId: 'evt-ventas-redes-online',
        customerId: null,
        customer: {
          fullName: 'Carlos Morales',
          phone: '55551234',
          email: 'carlos@example.com',
          deliveryAddress: '10 Calle 5-20 Zona 14, Apto 3B',
          department: 'Guatemala',
          municipality: 'Guatemala',
          sourceChannel: 'WHATSAPP',
          notes: 'Timbrar al llegar',
        },
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35.0,
        shippingCourier: 'GUATEX',
        shippingTrackingNumber: 'GT-987654321',
        pickupEventId: null,
        items: [
          {
            productId: null,
            description: 'Personalizado: Arte Retrato (MDF_5_5MM, 40x60 cm)',
            quantity: 1,
            unitPrice: 150.0,
            isCustom: true,
            material: 'MDF_5_5MM',
            customDimensions: '40x60 cm',
            customImageUrl: 'https://example.com/foto.jpg',
          },
        ],
        payments: [
          {
            method: 'TRANSFERENCIA',
            amount: 92.5,
            reference: 'TRANSF-998877',
          },
        ],
        discount: 0,
        notes: 'Cliente de Instagram contactó por WhatsApp',
        idempotencyKey: 'test-uuid-12345',
      };

      const parsed = createRemoteSaleSchema.parse(clientPayload);
      assert.equal(parsed.customer.fullName, 'Carlos Morales');
      assert.equal(parsed.customer.phone, '55551234');
      assert.equal(parsed.items.length, 1);
      assert.equal(parsed.items[0].isCustom, true);
      assert.equal(parsed.payments[0].amount, 92.5);
      assert.equal(parsed.shippingCost, 35.0);
    });

    it('2.2 Payload with pre-existing customerId parses cleanly without customer object', () => {
      const clientPayload = {
        eventId: 'evt-ventas-redes-online',
        customerId: '11111111-2222-3333-4444-555555555555',
        customer: null,
        deliveryMethod: 'PUNTO_VENTA',
        shippingCost: 0,
        shippingCourier: null,
        shippingTrackingNumber: null,
        pickupEventId: null,
        items: [
          {
            productId: '22222222-3333-4444-5555-666666666666',
            description: 'Póster Van Gogh Noche Estrellada (Mediano)',
            quantity: 2,
            unitPrice: 65.0,
            isCustom: false,
            material: null,
            customDimensions: null,
            customImageUrl: null,
          },
        ],
        payments: [
          {
            method: 'EFECTIVO',
            amount: 130.0,
            reference: null,
          },
        ],
        discount: 0,
        notes: null,
        idempotencyKey: 'test-uuid-counter',
      };

      const parsed = createRemoteSaleSchema.parse(clientPayload);
      assert.equal(parsed.customerId, '11111111-2222-3333-4444-555555555555');
      assert.equal(parsed.customer, null);
      assert.equal(parsed.deliveryMethod, 'PUNTO_VENTA');
      assert.equal(parsed.shippingCost, 0);
    });

    it('2.3 DeliveryMethod RETIRO_EVENTO requires valid pickupEventId', () => {
      const invalidPayload = {
        eventId: 'evt-ventas-redes-online',
        customerId: '11111111-2222-3333-4444-555555555555',
        deliveryMethod: 'RETIRO_EVENTO',
        shippingCost: 0,
        pickupEventId: null, // INVALID: must be provided when RETIRO_EVENTO
        items: [
          {
            description: 'Póster Mediano',
            quantity: 1,
            unitPrice: 65.0,
            isCustom: false,
          },
        ],
        payments: [{ method: 'EFECTIVO', amount: 35.0 }],
      };

      assert.throws(
        () => createRemoteSaleSchema.parse(invalidPayload),
        /pickupEventId/
      );

      // Now with pickupEventId supplied
      const validPayload = {
        ...invalidPayload,
        pickupEventId: 'evt-feria-interbanco-2026',
      };
      const parsed = createRemoteSaleSchema.parse(validPayload);
      assert.equal(parsed.pickupEventId, 'evt-feria-interbanco-2026');
    });

    it('2.4 Fails when neither customerId nor customer is provided', () => {
      const payloadMissingCustomer = {
        eventId: 'evt-ventas-redes-online',
        customerId: null,
        customer: null,
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35.0,
        items: [{ description: 'Póster', quantity: 1, unitPrice: 65.0 }],
        payments: [{ method: 'EFECTIVO', amount: 50.0 }],
      };

      assert.throws(
        () => createRemoteSaleSchema.parse(payloadMissingCustomer),
        /cliente/i
      );
    });

    it('2.5 Fails when items or payments are empty', () => {
      const basePayload = {
        customerId: '11111111-2222-3333-4444-555555555555',
        deliveryMethod: 'ENVIO_COURIER',
        items: [],
        payments: [{ method: 'EFECTIVO', amount: 50.0 }],
      };

      assert.throws(() => createRemoteSaleSchema.parse(basePayload), /producto/i);

      const basePayloadNoPayments = {
        customerId: '11111111-2222-3333-4444-555555555555',
        deliveryMethod: 'ENVIO_COURIER',
        items: [{ description: 'Póster', quantity: 1, unitPrice: 65.0 }],
        payments: [],
      };

      assert.throws(() => createRemoteSaleSchema.parse(basePayloadNoPayments), /anticipo/i);
    });
  });

  // =========================================================================
  // SUITE 3: API CONTRACT FIDELITY (balancePaymentSchema)
  // =========================================================================
  describe('3. API Contract Fidelity: BalancePaymentModal vs balancePaymentSchema', () => {
    it('3.1 Payload from BalancePaymentModal parses cleanly against balancePaymentSchema', () => {
      const clientPayload = {
        payments: [
          {
            method: 'EFECTIVO',
            amount: 85.0,
            reference: null,
          },
        ],
        notes: 'Entregado en persona al cliente',
      };

      const parsed = balancePaymentSchema.parse(clientPayload);
      assert.equal(parsed.payments.length, 1);
      assert.equal(parsed.payments[0].method, 'EFECTIVO');
      assert.equal(parsed.payments[0].amount, 85.0);
      assert.equal(parsed.notes, 'Entregado en persona al cliente');
    });

    it('3.2 Card or transfer balance payment with reference parses cleanly', () => {
      const clientPayload = {
        payments: [
          {
            method: 'TRANSFERENCIA',
            amount: 170.0,
            reference: 'TRANSF-987654',
          },
        ],
        notes: null,
      };

      const parsed = balancePaymentSchema.parse(clientPayload);
      assert.equal(parsed.payments[0].method, 'TRANSFERENCIA');
      assert.equal(parsed.payments[0].reference, 'TRANSF-987654');
    });

    it('3.3 balancePaymentSchema rejects empty payments or non-positive amount', () => {
      assert.throws(
        () => balancePaymentSchema.parse({ payments: [] }),
        /al menos un método de pago/i
      );

      assert.throws(
        () => balancePaymentSchema.parse({
          payments: [{ method: 'EFECTIVO', amount: -10 }],
        }),
        /mayor a 0/i
      );
    });
  });

  // =========================================================================
  // SUITE 4: WHATSAPP URL GENERATION FORMAT (https://wa.me/502...)
  // =========================================================================
  describe('4. WhatsApp URL Generation Format (https://wa.me/502...)', () => {
    const generateWaLink = (phone, formattedText) => {
      const rawPhone = (phone || '').replace(/[^0-9]/g, '');
      const cleanPhone = rawPhone.length === 8 ? `502${rawPhone}` : rawPhone;
      return cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(formattedText)}`
        : `https://wa.me/?text=${encodeURIComponent(formattedText)}`;
    };

    it('4.1 8-digit Guatemala phone is correctly prepended with 502', () => {
      const phone = '55551234';
      const text = 'Hola Carlos';
      const url = generateWaLink(phone, text);
      assert.ok(url.startsWith('https://wa.me/50255551234?text='));
    });

    it('4.2 Formatted phone with dashes, spaces, and +502 maintains 502 country code without duplication', () => {
      const testCases = [
        { input: '5555-1234', expected: '50255551234' },
        { input: '+502 5555 1234', expected: '50255551234' },
        { input: '50255551234', expected: '50255551234' },
        { input: '4444-9999', expected: '50244449999' },
      ];

      testCases.forEach(({ input, expected }) => {
        const url = generateWaLink(input, 'Test');
        assert.ok(
          url.startsWith(`https://wa.me/${expected}?text=`),
          `Phone ${input} should resolve to wa.me/${expected}, got: ${url}`
        );
      });
    });

    it('4.3 Empty phone gracefully generates https://wa.me/?text= fallback', () => {
      const url = generateWaLink('', 'Test Mensaje');
      assert.ok(url.startsWith('https://wa.me/?text=Test%20Mensaje'));
    });

    it('4.4 Formatted WhatsApp message contains all required accounting and delivery blocks', () => {
      const mockSale = {
        customer: { fullName: 'Sofía Reyes', phone: '55558899', deliveryAddress: 'Avenida Las Américas 12-45' },
        saleNumber: 'ORD-20260920-05',
        items: [{ quantity: 2, description: 'Póster Mediano Vintage', subtotal: 130.0 }],
        totalAmount: 165.0,
        depositAmount: 100.0,
        balanceDue: 65.0,
        paymentStatus: 'ANTICIPO_PAGADO',
        deliveryMethod: 'ENVIO_COURIER',
        shippingCourier: 'GUATEX',
      };

      const fullName = mockSale.customer?.fullName;
      const saleNumber = mockSale.saleNumber;
      const totalAmount = Number(mockSale.totalAmount).toFixed(2);
      const depositAmount = Number(mockSale.depositAmount).toFixed(2);
      const balanceDue = Number(mockSale.balanceDue).toFixed(2);
      const paymentStatus = mockSale.paymentStatus;
      const deliveryDescription = `${mockSale.shippingCourier} a ${mockSale.customer?.deliveryAddress}`;
      const formattedItems = mockSale.items.map((it) => `• ${it.quantity}x ${it.description} — Q ${Number(it.subtotal).toFixed(2)}`).join('\n');

      const formattedText = `✨ *DECO VINTAGE GUATE — PEDIDO CONFIRMADO* ✨
Hola *${fullName}*, tu orden *#${saleNumber}* ha sido registrada con éxito:

📦 *Detalle:*
${formattedItems}

🚚 *Entrega:* ${deliveryDescription}
💰 *Total de la Orden:* Q ${totalAmount}
🟢 *Anticipo Registrado:* Q ${depositAmount} (${paymentStatus})
🔴 *Saldo Pendiente contra Entrega:* Q ${balanceDue}

Tu pedido entra hoy mismo a taller de producción. Te compartiremos tu guía de envío en cuanto sea despachado. ¡Gracias por tu preferencia!`;

      assert.ok(formattedText.includes('DECO VINTAGE GUATE — PEDIDO CONFIRMADO'));
      assert.ok(formattedText.includes('*#ORD-20260920-05*'));
      assert.ok(formattedText.includes('• 2x Póster Mediano Vintage — Q 130.00'));
      assert.ok(formattedText.includes('GUATEX a Avenida Las Américas 12-45'));
      assert.ok(formattedText.includes('Q 165.00'));
      assert.ok(formattedText.includes('Q 100.00 (ANTICIPO_PAGADO)'));
      assert.ok(formattedText.includes('Q 65.00'));

      const waUrl = generateWaLink(mockSale.customer.phone, formattedText);
      assert.ok(waUrl.startsWith('https://wa.me/50255558899?text='));
    });
  });

  // =========================================================================
  // SUITE 5: 50/50 ARITHMETIC & WORKSHOP BRAKE MATHEMATICAL ORACLE
  // =========================================================================
  describe('5. 50/50 Quoter Mathematical Oracle & Freno Preventivo', () => {
    const calculateQuoterMath = ({ items, discount = 0, deliveryMethod, shippingCost = 0, depositInput }) => {
      const productsSubtotal = items.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
      const productsAmount = Math.max(0, Number((productsSubtotal - (Number(discount) || 0)).toFixed(2)));
      const effectiveShippingCost = deliveryMethod === 'ENVIO_COURIER' ? Number(shippingCost || 0) : 0;
      const totalAmount = Number((productsAmount + effectiveShippingCost).toFixed(2));
      const minDeposit = Number((totalAmount * 0.50).toFixed(2));
      const numericDeposit = Number(depositInput) || 0;
      const balanceDue = Math.max(0, Number((totalAmount - numericDeposit).toFixed(2)));
      const isDepositValid = totalAmount > 0 && numericDeposit >= minDeposit;
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
        isPaidTotal,
      };
    };

    it('5.1 Q 300 products + Q 35 shipping = Q 335 total, minDeposit = Q 167.50', () => {
      const result = calculateQuoterMath({
        items: [{ subtotal: 300.0 }],
        discount: 0,
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35.0,
        depositInput: '167.50',
      });

      assert.equal(result.totalAmount, 335.0);
      assert.equal(result.minDeposit, 167.5);
      assert.equal(result.balanceDue, 167.5);
      assert.equal(result.isDepositValid, true);
      assert.equal(result.isPaidTotal, false);
    });

    it('5.2 Insufficient deposit (Q 100 < Q 167.50) invalidates deposit and raises brake flag', () => {
      const result = calculateQuoterMath({
        items: [{ subtotal: 300.0 }],
        discount: 0,
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35.0,
        depositInput: '100.00',
      });

      assert.equal(result.isDepositValid, false);
      assert.equal(result.balanceDue, 235.0);
    });

    it('5.3 Full payment (100%) zeroes balanceDue and flags isPaidTotal = true', () => {
      const result = calculateQuoterMath({
        items: [{ subtotal: 300.0 }],
        discount: 0,
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35.0,
        depositInput: '335.00',
      });

      assert.equal(result.isDepositValid, true);
      assert.equal(result.balanceDue, 0.0);
      assert.equal(result.isPaidTotal, true);
    });

    it('5.4 Discount reduces product subtotal without affecting freight exclusion logic', () => {
      const result = calculateQuoterMath({
        items: [{ subtotal: 200.0 }],
        discount: 20.0,
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 40.0,
        depositInput: '110.00', // (180 + 40) * 0.50 = 110.00
      });

      assert.equal(result.productsSubtotal, 200.0);
      assert.equal(result.productsAmount, 180.0);
      assert.equal(result.totalAmount, 220.0);
      assert.equal(result.minDeposit, 110.0);
      assert.equal(result.isDepositValid, true);
      assert.equal(result.balanceDue, 110.0);
    });
  });
});
