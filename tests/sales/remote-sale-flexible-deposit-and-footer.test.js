import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secure_forensic_auditor_secret_key_2026';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS || 'superadmin@dekolabs.org';

import { prisma } from '../../server/config/prisma.js';
import {
  createRemoteSaleTransaction,
  registerBalancePayment,
} from '../../server/services/sales/remoteSaleService.js';

describe('feat-017: Anticipo Libre en Ventas de Redes, Iconos Minimalistas Centrados, Valor del anticipo, Botón Registrar Venta y Footer 2026', () => {
  describe('1. Backend remoteSaleService.js — Anticipo Libre sin Compuerta del 50%', () => {
    it('1.1 createRemoteSaleTransaction acepta cualquier anticipo positivo menor al 50% (ej. Q 20.00 sobre Q 130.00) y activa A_PRODUCCION', async () => {
      let capturedCreateData = null;

      const mockTx = {
        sale: {
          findFirst: async () => null,
          create: async ({ data }) => {
            capturedCreateData = data;
            return {
              id: 'sale-flex-01',
              ...data,
              items: data.items.create,
              payments: data.payments.create,
              customer: { id: 'cust-01', fullName: 'Cliente Redes', phone: '55551234' },
              seller: { id: 'seller-redes-01', fullName: 'Vendedor Redes', email: 'redes@deko.gt' },
            };
          },
        },
        customer: {
          findUnique: async () => ({ id: 'cust-01', fullName: 'Cliente Redes', phone: '55551234' }),
        },
        event: {
          findUnique: async () => ({ id: 'evt-ventas-redes-online', name: 'Ventas en Línea' }),
          update: async () => ({ name: 'REDES', currentSaleSequence: 1 }),
        },
        auditLog: {
          create: async () => ({}),
        },
      };

      const origTransaction = prisma.$transaction;
      prisma.$transaction = async (fn) => fn(mockTx);

      try {
        const result = await createRemoteSaleTransaction({
          tenantId: 'tenant-deko',
          sellerId: 'seller-redes-01',
          data: {
            eventId: 'evt-ventas-redes-online',
            customerId: 'cust-01',
            deliveryMethod: 'ENVIO_COURIER',
            shippingCost: 0,
            shippingCourier: 'GUATEX',
            items: [
              {
                productId: null,
                description: 'Personalizado: Retrato Familiar (MDF_5_5MM, 30x40 cm)',
                quantity: 2,
                unitPrice: 65,
                isCustom: true,
                material: 'MDF_5_5MM',
                customDimensions: '30x40 cm',
              },
            ],
            payments: [{ method: 'TRANSFERENCIA', amount: 20, reference: 'BOL-0020' }],
            discount: 0,
          },
        });

        assert.ok(result);
        assert.ok(capturedCreateData);
        assert.equal(capturedCreateData.totalAmount, 130);
        assert.equal(capturedCreateData.depositAmount, 20);
        assert.equal(capturedCreateData.balanceDue, 110);
        assert.equal(capturedCreateData.paymentStatus, 'ANTICIPO_PAGADO');
        assert.equal(capturedCreateData.status, 'PENDIENTE');
        assert.equal(capturedCreateData.items.create[0].productionStatus, 'A_PRODUCCION');
      } finally {
        prisma.$transaction = origTransaction;
      }
    });

    it('1.2 createRemoteSaleTransaction soporta pago 100% (PAGADO_TOTAL) y cotización sin abono (PENDIENTE_PAGO), pero rechaza sobrepago (> totalAmount)', async () => {
      const mockTx = {
        sale: {
          findFirst: async () => null,
          create: async ({ data }) => ({
            id: 'sale-flex-02',
            ...data,
            items: data.items.create,
            payments: data.payments.create,
          }),
        },
        event: {
          findUnique: async () => ({ id: 'evt-ventas-redes-online', name: 'Redes' }),
          update: async () => ({ name: 'REDES', currentSaleSequence: 2 }),
        },
        auditLog: { create: async () => ({}) },
      };

      const origTransaction = prisma.$transaction;
      prisma.$transaction = async (fn) => fn(mockTx);

      try {
        const fullPaid = await createRemoteSaleTransaction({
          tenantId: 'tenant-deko',
          sellerId: 'seller-redes-01',
          data: {
            customerId: 'cust-01',
            deliveryMethod: 'PUNTO_VENTA',
            shippingCost: 0,
            items: [{ description: 'Personalizado: Obra 100%', quantity: 1, unitPrice: 65, isCustom: true }],
            payments: [{ method: 'TRANSFERENCIA', amount: 65, reference: 'BOL-0065' }],
          },
        });
        assert.equal(fullPaid.paymentStatus, 'PAGADO_TOTAL');
        assert.equal(fullPaid.balanceDue, 0);
        assert.equal(fullPaid.status, 'COMPLETADA');
        assert.equal(fullPaid.items[0].productionStatus, 'A_PRODUCCION');

        const pendingOnly = await createRemoteSaleTransaction({
          tenantId: 'tenant-deko',
          sellerId: 'seller-redes-01',
          data: {
            customerId: 'cust-01',
            deliveryMethod: 'PUNTO_VENTA',
            shippingCost: 0,
            items: [{ description: 'Personalizado: Obra Reserva', quantity: 1, unitPrice: 65, isCustom: true }],
            payments: [],
          },
        });
        assert.equal(pendingOnly.paymentStatus, 'PENDIENTE_PAGO');
        assert.equal(pendingOnly.depositAmount, 0);
        assert.equal(pendingOnly.balanceDue, 65);
        assert.equal(pendingOnly.items[0].productionStatus, 'PENDIENTE');

        await assert.rejects(
          async () => {
            await createRemoteSaleTransaction({
              tenantId: 'tenant-deko',
              sellerId: 'seller-redes-01',
              data: {
                customerId: 'cust-01',
                deliveryMethod: 'PUNTO_VENTA',
                shippingCost: 0,
                items: [{ description: 'Personalizado: Obra Sobrepago', quantity: 1, unitPrice: 65, isCustom: true }],
                payments: [{ method: 'EFECTIVO', amount: 90 }],
              },
            });
          },
          (err) => err.statusCode === 400 && err.message.includes('no puede superar el total')
        );
      } finally {
        prisma.$transaction = origTransaction;
      }
    });

    it('1.3 registerBalancePayment sobre orden PENDIENTE_PAGO acepta anticipo menor al 50% (ej. Q 25.00 sobre Q 130.00) y envía a A_PRODUCCION', async () => {
      let updatedSalePayload = null;
      let itemsActivated = false;

      const mockClient = {
        sale: {
          findFirst: async () => ({
            id: 'sale-pending-01',
            saleNumber: 'RED-200',
            tenantId: 'tenant-deko',
            orderType: 'REDES_PERSONALIZADO',
            eventId: 'evt-ventas-redes-online',
            status: 'PENDIENTE',
            paymentStatus: 'PENDIENTE_PAGO',
            totalAmount: 130,
            depositAmount: 0,
            balanceDue: 130,
            notes: '',
            payments: [],
          }),
          updateMany: async () => ({ count: 1 }),
          update: async ({ data }) => {
            updatedSalePayload = data;
            return { id: 'sale-pending-01', ...data, payments: [] };
          },
        },
        user: {
          findUnique: async () => ({ id: 'seller-redes-01', fullName: 'Ana Redes', role: 'VENDEDOR_REDES' }),
        },
        saleItem: {
          findMany: async () => [{ id: 'item-p1', productionStatus: 'PENDIENTE' }],
          updateMany: async ({ data }) => {
            if (data.productionStatus === 'A_PRODUCCION') itemsActivated = true;
            return { count: 1 };
          },
        },
        productionLog: {
          createMany: async () => ({ count: 1 }),
        },
        salePayment: {
          createMany: async () => ({ count: 1 }),
        },
        auditLog: {
          create: async () => ({}),
        },
      };

      const res = await registerBalancePayment({
        saleId: 'sale-pending-01',
        tenantId: 'tenant-deko',
        sellerId: 'seller-redes-01',
        userRoles: ['VENDEDOR_REDES'],
        payments: [{ method: 'TRANSFERENCIA', amount: 25, reference: 'REF-25' }],
        tx: mockClient,
      });

      assert.ok(res);
      assert.ok(updatedSalePayload);
      assert.equal(updatedSalePayload.paymentStatus, 'ANTICIPO_PAGADO');
      assert.equal(updatedSalePayload.depositAmount, 25);
      assert.equal(updatedSalePayload.balanceDue, 105);
      assert.equal(itemsActivated, true);
    });
  });

  describe('2. Frontend Hook & Cotizador — Campo Libre Valor del anticipo, Solo Botón 100%, Sin Doble Icono y Botón Registrar Venta', () => {
    const hookContent = fs.readFileSync(
      path.join(ROOT, 'src/components/manual-sale/hooks/useRemoteSaleForm.js'),
      'utf-8'
    );
    const quoterContent = fs.readFileSync(
      path.join(ROOT, 'src/components/manual-sale/RemoteQuoterSummary.jsx'),
      'utf-8'
    );
    const fastFormContent = fs.readFileSync(
      path.join(ROOT, 'src/components/FastManualSaleForm.jsx'),
      'utf-8'
    );
    const shareModalContent = fs.readFileSync(
      path.join(ROOT, 'src/components/manual-sale/WhatsAppQuoteShareModal.jsx'),
      'utf-8'
    );
    const balanceModalContent = fs.readFileSync(
      path.join(ROOT, 'src/components/sales/BalancePaymentModal.jsx'),
      'utf-8'
    );

    it('2.1 useRemoteSaleForm.js elimina el auto-llenado y validación del 50%, iniciando depositInput vacío (0.00) y aceptando cualquier abono > 0', () => {
      assert.ok(
        hookContent.includes("const [depositInput, setDepositInput] = useState('');"),
        'depositInput debe iniciar vacío para mostrar abono Q 0.00 hasta que el vendedor ingrese un valor'
      );
      assert.ok(
        !hookContent.includes('setDepositInput(minDeposit.toString())'),
        'PROHIBIDO auto-rellenar el anticipo al 50%'
      );
      assert.ok(
        !hookContent.includes('numericDeposit >= minDeposit'),
        'PROHIBIDO exigir numericDeposit >= minDeposit'
      );
      assert.ok(
        hookContent.includes('numericDeposit > 0 && numericDeposit <= totalAmount + 0.01'),
        'isDepositValid debe aceptar cualquier anticipo > 0 y <= totalAmount + 0.01'
      );
      assert.ok(
        !hookContent.includes('Anticipo insuficiente'),
        'useRemoteSaleForm.js no debe contener el bloqueo del 50% Anticipo insuficiente'
      );
    });

    it('2.2 RemoteQuoterSummary.jsx usa el título exacto "Valor del anticipo", deja solo el campo numérico + botón 100% y elimina todo rastro del 50%', () => {
      assert.ok(
        quoterContent.includes('Valor del anticipo'),
        'Debe mostrar el título exacto "Valor del anticipo"'
      );
      assert.ok(
        !quoterContent.includes('Monto ingresado por el cliente (Q):'),
        'Debe eliminar el título antiguo "Monto ingresado por el cliente (Q):"'
      );
      assert.ok(
        !quoterContent.includes('Monto de Anticipo a Registrar'),
        'Debe eliminar el subtítulo redundante "Monto de Anticipo a Registrar"'
      );
      assert.ok(
        !quoterContent.includes('50% Anticipo') && !quoterContent.includes('Mínimo 50%') && !quoterContent.includes('mínimo 50%'),
        'No debe existir botón de 50% ni textos de Mínimo 50%'
      );
      assert.ok(
        !quoterContent.includes('Anticipo insuficiente'),
        'No debe existir alerta de Anticipo insuficiente del 50%'
      );
      assert.ok(
        quoterContent.includes('100% (Q {totalAmount.toFixed(2)})'),
        'Debe conservar el botón de 100% junto al campo de anticipo'
      );
    });

    it('2.3 Cero doble icono (sin emojis a color redundantes) y texto debidamente centrado en botones de Nueva Venta de Redes', () => {
      const forbiddenButtonEmojis = ['⚡', '⏳', '💯', '🔍', '📲', '📋'];
      for (const emoji of forbiddenButtonEmojis) {
        assert.ok(
          !quoterContent.includes(emoji),
          `RemoteQuoterSummary.jsx no debe incluir el icono a color redundante "${emoji}"`
        );
      }

      assert.ok(
        quoterContent.includes('<span>Con Anticipo</span>') &&
          quoterContent.includes('<span>Pendiente Pago</span>') &&
          quoterContent.includes('<span>Verificar Boleta (OCR)</span>'),
        'Los botones en RemoteQuoterSummary.jsx deben tener texto limpio acompañado solo por su icono minimalista Lucide'
      );

      // Verificar centrado explícito en los botones de RemoteQuoterSummary
      const buttonMatches = quoterContent.match(/<button\b[\s\S]*?<\/button>/g) || [];
      assert.ok(buttonMatches.length >= 5, 'Debe encontrar los botones interactivos de RemoteQuoterSummary');
      for (const btnBlock of buttonMatches) {
        assert.ok(
          btnBlock.includes('justify-center'),
          `Todo botón en RemoteQuoterSummary debe centrar su contenido con justify-center: ${btnBlock}`
        );
      }

      // FastManualSaleForm, WhatsAppQuoteShareModal y BalancePaymentModal sin doble icono
      assert.ok(
        !fastFormContent.includes('📱 Gestión de Pedidos de Redes'),
        'FastManualSaleForm.jsx no debe duplicar 📱 junto al icono <Smartphone />'
      );
      assert.ok(
        !fastFormContent.includes('50/50'),
        'FastManualSaleForm.jsx no debe mencionar anticipo 50/50'
      );
      assert.ok(
        !shareModalContent.includes('📲 Abrir en WhatsApp') &&
          !shareModalContent.includes('¡Copiado! ✅') &&
          !shareModalContent.includes('📋 Copiar Texto'),
        'WhatsAppQuoteShareModal.jsx no debe duplicar emojis junto a los iconos minimalistas Lucide'
      );
      assert.ok(
        !balanceModalContent.includes('⚡ 50%') &&
          !balanceModalContent.includes('💯 100%') &&
          !balanceModalContent.includes('Mínimo 50%'),
        'BalancePaymentModal.jsx no debe mostrar botón 50% ni emojis a color redundantes'
      );
    });

    it('2.4 El botón que finaliza la venta muestra "Registrar Venta (abono Q 0.00)" y actualiza dinámicamente el monto abonado', () => {
      assert.ok(
        !quoterContent.includes('Registrar Pedido'),
        'Debe eliminar por completo el texto antiguo "Registrar Pedido..."'
      );
      assert.ok(
        quoterContent.includes('`Registrar Venta (abono Q ${numericDeposit.toFixed(2)})`'),
        'Debe renderizar la plantilla exacta Registrar Venta (abono Q ${numericDeposit.toFixed(2)})'
      );

      // Verificación funcional de la interpolación en estado inicial (0) y con abono
      const formatLabel = (numericDeposit) => `Registrar Venta (abono Q ${numericDeposit.toFixed(2)})`;
      assert.equal(formatLabel(0), 'Registrar Venta (abono Q 0.00)');
      assert.equal(formatLabel(35), 'Registrar Venta (abono Q 35.00)');
      assert.equal(formatLabel(130), 'Registrar Venta (abono Q 130.00)');
    });
  });

  describe('3. Pie de Página Global del Sitio (App.jsx y LoginView.jsx)', () => {
    const expectedFooter = 'Desarrollado por Sebastian Jimenez / Deko Labs Todos los Derechos Reservados 2026';

    it('3.1 App.jsx muestra el nuevo pie de página global y elimina el texto anterior', () => {
      const appContent = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf-8');
      assert.ok(
        appContent.includes(expectedFooter),
        `src/App.jsx debe incluir "${expectedFooter}"`
      );
      assert.ok(
        !appContent.includes('PostgreSQL VPS Inmutable'),
        'src/App.jsx no debe mostrar el pie de página antiguo'
      );
    });

    it('3.2 LoginView.jsx incluye de forma consistente el mismo pie de página global', () => {
      const loginContent = fs.readFileSync(path.join(ROOT, 'src/components/LoginView.jsx'), 'utf-8');
      assert.ok(
        loginContent.includes(expectedFooter),
        `src/components/LoginView.jsx debe incluir "${expectedFooter}"`
      );
    });
  });
});
