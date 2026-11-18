import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secure_design_edition_feat019_jwt_secret_2026';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS || 'superadmin@dekolabs.org';

import { createRemoteSaleSchema } from '../../server/validators/remoteSaleValidators.js';
import { prisma } from '../../server/config/prisma.js';
import { createRemoteSaleTransaction } from '../../server/services/sales/remoteSaleService.js';
import { calculateSaleProductBase } from '../../server/services/commissionService.js';

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

const remoteHookHelpers = await loadModuleHeaderExports(
  'src/components/manual-sale/hooks/useRemoteSaleForm.js',
  'export function useRemoteSaleForm'
);
const shareModalHelpers = await loadModuleHeaderExports(
  'src/components/manual-sale/WhatsAppQuoteShareModal.jsx',
  'export default function WhatsAppQuoteShareModal'
);

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
        if (ch === '\\') { i += 2; continue; }
        if (ch === inQuote) inQuote = null;
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

describe('feat-019: Casilla de Edición de Diseño (Descripción + Costo Sumado al Total) en Nueva Venta de Redes', () => {
  const editionPanelPath = path.join(ROOT, 'src/components/manual-sale/DesignEditionPanel.jsx');
  const fastFormPath = path.join(ROOT, 'src/components/FastManualSaleForm.jsx');
  const hookPath = path.join(ROOT, 'src/components/manual-sale/hooks/useRemoteSaleForm.js');
  const quoterPath = path.join(ROOT, 'src/components/manual-sale/RemoteQuoterSummary.jsx');
  const shareModalPath = path.join(ROOT, 'src/components/manual-sale/WhatsAppQuoteShareModal.jsx');
  const deliveryPath = path.join(ROOT, 'src/components/manual-sale/DeliveryMethodSelector.jsx');

  const editionPanelContent = fs.readFileSync(editionPanelPath, 'utf8');
  const fastFormContent = fs.readFileSync(fastFormPath, 'utf8');
  const hookContent = fs.readFileSync(hookPath, 'utf8');
  const quoterContent = fs.readFileSync(quoterPath, 'utf8');
  const shareModalContent = fs.readFileSync(shareModalPath, 'utf8');
  const deliveryContent = fs.readFileSync(deliveryPath, 'utf8');

  describe('1. Ubicación Exacta en Formulario y Diseño Minimalista de DesignEditionPanel.jsx', () => {
    it('1.1 DesignEditionPanel.jsx se monta en REDES_PERSONALIZADO inmediatamente debajo de SaleCartList y arriba de DeliveryMethodSelector', () => {
      const redesStart = fastFormContent.indexOf("saleMode === 'REDES_PERSONALIZADO'");
      const mostradorStart = fastFormContent.indexOf('MODO MOSTRADOR (FERIA 100%)');
      assert.ok(redesStart !== -1 && mostradorStart !== -1);

      const redesSection = fastFormContent.slice(redesStart, mostradorStart);
      const mostradorSection = fastFormContent.slice(mostradorStart);

      const cartIdx = redesSection.indexOf('<SaleCartList');
      const editionIdx = redesSection.indexOf('<DesignEditionPanel');
      const deliveryIdx = redesSection.indexOf('<DeliveryMethodSelector');
      const quoterIdx = redesSection.indexOf('<RemoteQuoterSummary');

      assert.ok(cartIdx !== -1, 'REDES debe incluir SaleCartList');
      assert.ok(editionIdx !== -1, 'REDES debe incluir DesignEditionPanel');
      assert.ok(deliveryIdx !== -1, 'REDES debe incluir DeliveryMethodSelector');
      assert.ok(quoterIdx !== -1, 'REDES debe incluir RemoteQuoterSummary');

      assert.ok(cartIdx < editionIdx, 'DesignEditionPanel debe ubicarse inmediatamente debajo de SaleCartList');
      assert.ok(editionIdx < deliveryIdx, 'DesignEditionPanel debe ubicarse arriba de DeliveryMethodSelector');
      assert.ok(deliveryIdx < quoterIdx, 'DeliveryMethodSelector debe mantenerse arriba de RemoteQuoterSummary');
      assert.ok(!mostradorSection.includes('<DesignEditionPanel'), 'POS_FERIA no debe montar DesignEditionPanel');
    });

    it('1.2 DesignEditionPanel.jsx expone "Descripción de la edición" y "Costo de la edición (Q)" con ergonomía >= 44px y cero tonos naranja', () => {
      assert.ok(editionPanelContent.includes('Edición de Diseño (Opcional)'));
      assert.ok(editionPanelContent.includes('Descripción de la edición'));
      assert.ok(editionPanelContent.includes('Ej. Se agregaron letras en la esquina inferior'));
      assert.ok(editionPanelContent.includes('Costo de la edición (Q)'));
      assert.ok(editionPanelContent.includes('placeholder="0.00"'));
      assert.ok(editionPanelContent.includes('+ Q {effectiveEditionCost.toFixed(2)}'));

      const controls = extractOpeningTags(editionPanelContent);
      assert.ok(controls.length >= 2, 'DesignEditionPanel debe tener al menos los 2 inputs de edición');
      for (const [idx, ctrl] of controls.entries()) {
        assert.ok(
          ctrl.tagContent.includes('min-h-[44px]') || ctrl.tagContent.includes('min-h-[48px]'),
          `Control #${idx + 1} en DesignEditionPanel debe cumplir min-h-[44px]: ${ctrl.tagContent}`
        );
      }

      assert.ok(!/amber-|orange-/.test(editionPanelContent), 'Cero clases amber/orange en DesignEditionPanel.jsx');
    });

    it('1.3 RemoteQuoterSummary.jsx desglosa "Edición de diseño:" antes de "Envío / Flete:" y preserva la numeración 3 y 4', () => {
      assert.ok(deliveryContent.includes('<span>3. Método de Entrega & Logística</span>'));
      assert.ok(quoterContent.includes('<span>4. Cotizador & Registro de Anticipo</span>'));

      const subIdx = quoterContent.indexOf('Subtotal Productos:');
      const edIdx = quoterContent.indexOf('Edición de diseño:');
      const shipIdx = quoterContent.indexOf('Envío / Flete:');
      const totIdx = quoterContent.indexOf('Total de la Orden:');

      assert.ok(subIdx !== -1 && edIdx !== -1 && shipIdx !== -1 && totIdx !== -1);
      assert.ok(subIdx < edIdx && edIdx < shipIdx && shipIdx < totIdx);
    });
  });

  describe('2. Aritmética Reactiva en useRemoteSaleForm.js y Desglose en WhatsAppQuoteShareModal.jsx', () => {
    it('2.1 calculateRemoteOrderTotals suma exactamente productsAmount + effectiveEditionCost + effectiveShippingCost', () => {
      const resCourier = remoteHookHelpers.calculateRemoteOrderTotals({
        cartItems: [
          { subtotal: 65 },
          { subtotal: 65 },
        ],
        discount: 10,
        editionCost: '25.5',
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35,
      });

      assert.equal(resCourier.productsSubtotal, 130);
      assert.equal(resCourier.productsAmount, 120);
      assert.equal(resCourier.effectiveEditionCost, 25.5);
      assert.equal(resCourier.effectiveShippingCost, 35);
      assert.equal(resCourier.totalAmount, 180.5);

      const resPickup = remoteHookHelpers.calculateRemoteOrderTotals({
        cartItems: [{ subtotal: 80 }],
        discount: 0,
        editionCost: '15',
        deliveryMethod: 'RETIRO_EVENTO',
        shippingCost: 35,
      });
      assert.equal(resPickup.effectiveEditionCost, 15);
      assert.equal(resPickup.effectiveShippingCost, 0);
      assert.equal(resPickup.totalAmount, 95);

      const resEmptyEdition = remoteHookHelpers.calculateRemoteOrderTotals({
        cartItems: [{ subtotal: 65 }],
        discount: 0,
        editionCost: '',
        deliveryMethod: 'PUNTO_VENTA',
        shippingCost: 0,
      });
      assert.equal(resEmptyEdition.effectiveEditionCost, 0);
      assert.equal(resEmptyEdition.totalAmount, 65);
    });

    it('2.2 useRemoteSaleForm.js valida descripción cuando editionCost > 0, envía editionCost/editionDescription y limpia estados al completar', () => {
      assert.ok(
        hookContent.includes('if (effectiveEditionCost > 0 && !editionDescription.trim())'),
        'confirmRemoteSale debe exigir descripción si se ingresa un costo de edición > 0'
      );
      assert.ok(
        hookContent.includes('editionDescription: editionDescription.trim() || null') &&
          hookContent.includes('editionCost: effectiveEditionCost'),
        'El payload de POST /api/sales/remote debe incluir editionDescription y editionCost'
      );
      assert.ok(
        hookContent.includes("setEditionDescription('');") && hookContent.includes("setEditionCost('');"),
        'confirmRemoteSale debe limpiar editionDescription y editionCost tras registrar la venta'
      );
    });

    it('2.3 WhatsAppQuoteShareModal incluye el cargo de edición tanto desde props directas como desde el sello en sale.notes', () => {
      const directMsg = shareModalHelpers.buildWhatsAppOrderMessage({
        saleNumber: 'RED-501',
        customer: { fullName: 'Carlos Méndez', phone: '55112233', deliveryAddress: 'Zona 15 Vista Hermosa' },
        deliveryMethod: 'ENVIO_COURIER',
        shippingCourier: 'GUATEX',
        shippingCost: 35,
        editionCost: 25,
        editionDescription: 'Se agregaron letras en la esquina inferior',
        totalAmount: 125,
        depositAmount: 50,
        balanceDue: 75,
        paymentStatus: 'ANTICIPO_PAGADO',
        items: [{ quantity: 1, description: 'Personalizado: Retrato Mascota (MDF_5_5MM, 30x40 cm)', subtotal: 65 }],
      });

      assert.match(directMsg, /Edición de diseño \(Se agregaron letras en la esquina inferior\) — Q 25\.00/);
      assert.match(directMsg, /Flete: Q 35\.00/);
      assert.match(directMsg, /\*Total de la Orden:\* Q 125\.00/);

      const fromNotesMsg = shareModalHelpers.buildWhatsAppOrderMessage({
        saleNumber: 'RED-502',
        customer: { fullName: 'Andrea López', phone: '44332211' },
        deliveryMethod: 'PUNTO_VENTA',
        shippingCost: 0,
        notes: 'Empacar para regalo\n[Edición (+Q 30.00): Cambio de fondo y fecha conmemorativa]',
        totalAmount: 95,
        depositAmount: 95,
        balanceDue: 0,
        paymentStatus: 'PAGADO_TOTAL',
        items: [{ quantity: 1, description: 'Personalizado: Aniversario (PVC_5MM, 30x40 cm)', subtotal: 65 }],
      });

      assert.match(fromNotesMsg, /Edición de diseño \(Cambio de fondo y fecha conmemorativa\) — Q 30\.00/);
      assert.match(fromNotesMsg, /\*Total de la Orden:\* Q 95\.00/);
    });
  });

  describe('3. Validación Zod, Persistencia Backend sin SaleItem Fantasma e Invarianza de Comisiones', () => {
    const baseValidPayload = {
      eventId: 'evt-ventas-redes-online',
      customer: {
        fullName: 'Valeria Soto',
        phone: '50255889900',
        deliveryAddress: 'Avenida Las Américas Zona 13',
        department: 'Guatemala',
        municipality: 'Guatemala',
        sourceChannel: 'WHATSAPP',
      },
      deliveryMethod: 'ENVIO_COURIER',
      shippingCost: 35,
      shippingCourier: 'FORZA',
      items: [
        {
          productId: null,
          description: 'Personalizado: Póster Conmemorativo (MDF_5_5MM, 30x45 cm)',
          quantity: 2,
          unitPrice: 65,
          isCustom: true,
          material: 'MDF_5_5MM',
          customDimensions: '30x45 cm',
          customImageUrl: 'https://storage.googleapis.com/deko/conmemorativo.jpg',
        },
      ],
      payments: [{ method: 'TRANSFERENCIA', amount: 60, reference: 'BOL-ED-019' }],
      discount: 0,
    };

    it('3.1 createRemoteSaleSchema acepta editionDescription + editionCost >= 0 y rechaza costo > 0 sin descripción o negativo', () => {
      const parsed = createRemoteSaleSchema.parse({
        ...baseValidPayload,
        editionDescription: '  Se agregaron letras en la esquina inferior  ',
        editionCost: 25,
      });
      assert.equal(parsed.editionDescription, 'Se agregaron letras en la esquina inferior');
      assert.equal(parsed.editionCost, 25);

      const parsedDefault = createRemoteSaleSchema.parse(baseValidPayload);
      assert.equal(parsedDefault.editionCost, 0);

      assert.throws(
        () => createRemoteSaleSchema.parse({ ...baseValidPayload, editionCost: 20, editionDescription: '   ' }),
        /descripción de la edición es obligatoria/i
      );

      assert.throws(
        () => createRemoteSaleSchema.parse({ ...baseValidPayload, editionCost: -10, editionDescription: 'Error' }),
        /no puede ser negativo/i
      );
    });

    it('3.2 createRemoteSaleTransaction suma editionCost al total, estampa sale.notes y SaleItem.productionNotes para Taller sin crear SaleItem fantasma, e incluye la edición en la base comisionable del 20% (excluyendo flete)', async () => {
      let capturedSaleCreate = null;
      let capturedAuditCreate = null;

      const mockTx = {
        sale: {
          findFirst: async () => null,
          create: async ({ data }) => {
            capturedSaleCreate = data;
            return {
              id: 'sale-edition-019',
              ...data,
              items: data.items.create,
              payments: data.payments.create,
              customer: { id: 'cust-valeria', fullName: 'Valeria Soto', phone: '50255889900' },
              seller: { id: 'seller-redes-01', fullName: 'Vendedor Redes', email: 'redes@deko.gt' },
            };
          },
        },
        customer: {
          findUnique: async () => null,
          create: async ({ data }) => ({ id: 'cust-valeria', ...data }),
        },
        event: {
          findUnique: async () => ({ id: 'evt-ventas-redes-online', name: 'Ventas en Línea' }),
          update: async () => ({ name: 'REDES', currentSaleSequence: 19 }),
        },
        auditLog: {
          create: async ({ data }) => {
            capturedAuditCreate = data;
            return data;
          },
        },
      };

      const origTx = prisma.$transaction;
      prisma.$transaction = async (fn) => fn(mockTx);

      try {
        // Rechazo HTTP 400 si editionCost > 0 sin descripción en servicio directo
        await assert.rejects(
          async () => {
            await createRemoteSaleTransaction({
              tenantId: 'tenant-deko',
              sellerId: 'seller-redes-01',
              data: { ...baseValidPayload, editionCost: 25, editionDescription: '' },
            });
          },
          (err) => err.statusCode === 400 && /descripción de la edición es obligatoria/i.test(err.message)
        );

        // Creación exitosa: 2x Q65 (Q130) + Edición Q25 + Flete Q35 = Total Q190; Anticipo Q60 => Saldo Q130
        const sale = await createRemoteSaleTransaction({
          tenantId: 'tenant-deko',
          sellerId: 'seller-redes-01',
          data: {
            ...baseValidPayload,
            editionDescription: 'Se agregaron letras en la esquina inferior',
            editionCost: 25,
            notes: 'Cliente solicita revisión cuidadosa',
          },
        });

        assert.equal(sale.totalAmount, 190);
        assert.equal(sale.depositAmount, 60);
        assert.equal(sale.balanceDue, 130);
        assert.equal(sale.paymentStatus, 'ANTICIPO_PAGADO');
        assert.equal(sale.editionCost, 25);
        assert.equal(sale.editionDescription, 'Se agregaron letras en la esquina inferior');

        // CERO SaleItem fantasma en cola de impresión
        assert.equal(capturedSaleCreate.items.create.length, 1, 'NO debe crear un SaleItem ficticio para la edición');
        assert.equal(capturedSaleCreate.items.create[0].productionStatus, 'A_PRODUCCION');
        assert.equal(
          capturedSaleCreate.items.create[0].productionNotes,
          '[Edición]: Se agregaron letras en la esquina inferior',
          'Cada SaleItem debe llevar la instrucción de edición en productionNotes para ProductionOrderCard.jsx'
        );

        // Sello legible en sale.notes + nota original preservada
        assert.equal(
          capturedSaleCreate.notes,
          'Cliente solicita revisión cuidadosa\n[Edición (+Q 25.00): Se agregaron letras en la esquina inferior]'
        );

        // Registro de auditoría enriquecido
        assert.equal(capturedAuditCreate.details.editionCost, 25);
        assert.equal(capturedAuditCreate.details.editionDescription, 'Se agregaron letras en la esquina inferior');

        // Base de comisión del 20% suma pósters + edición (Q 130.00 + Q 25.00 = Q 155.00 -> Q 31.00) excluyendo el flete (Q 35.00)
        const commissionBase = calculateSaleProductBase(sale);
        assert.equal(commissionBase, 155, 'La base comisionable suma pósters (Q 130) + edición (Q 25) = Q 155.00 y excluye flete (Q 35)');
        assert.equal(Number((commissionBase * 0.20).toFixed(2)), 31, 'La comisión del 20% debe ser Q 31.00');
      } finally {
        prisma.$transaction = origTx;
      }
    });
  });

  describe('4. Techos Estrictos de Líneas y 0 CRLF', () => {
    it('4.1 Todos los módulos tocados respetan sus techos de líneas y tienen 0 CRLF', () => {
      const editionLines = editionPanelContent.split('\n').length;
      const formLines = fastFormContent.split('\n').length;
      const hookLines = hookContent.split('\n').length;
      const quoterLines = quoterContent.split('\n').length;
      const shareLines = shareModalContent.split('\n').length;

      assert.ok(editionLines <= 140, `DesignEditionPanel.jsx (${editionLines}L) debe ser <= 140L`);
      assert.ok(formLines <= 350, `FastManualSaleForm.jsx (${formLines}L) debe ser <= 350L`);
      assert.ok(hookLines <= 350, `useRemoteSaleForm.js (${hookLines}L) debe ser <= 350L`);
      assert.ok(quoterLines <= 350, `RemoteQuoterSummary.jsx (${quoterLines}L) debe ser <= 350L`);
      assert.ok(shareLines <= 280, `WhatsAppQuoteShareModal.jsx (${shareLines}L) debe ser <= 280L`);

      for (const rel of [
        'src/components/manual-sale/DesignEditionPanel.jsx',
        'src/components/FastManualSaleForm.jsx',
        'src/components/manual-sale/hooks/useRemoteSaleForm.js',
        'src/components/manual-sale/RemoteQuoterSummary.jsx',
        'src/components/manual-sale/WhatsAppQuoteShareModal.jsx',
        'server/validators/remoteSaleValidators.js',
        'server/services/sales/remoteSaleService.js',
      ]) {
        const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        assert.equal(raw.includes('\r\n'), false, `${rel} debe mantener 0 CRLF`);
      }
    });
  });
});
