import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secure_decimal_parity_feat021_jwt_secret_2026';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS || 'superadmin@dekolabs.org';

import {
  CUSTOM_MIN_CM,
  CUSTOM_MAX_CM,
  parseDecimalCm,
  formatDecimalCm,
  validateCustomDimensions,
  normalizePosterMaterial,
  calculateCustomPosterPrice,
} from '../../src/utils/customPosterPricing.js';
import {
  OFFICIAL_SIZES,
  CUSTOM_CM2_RATE,
  WOOD_CUSTOM_CUT_SURCHARGE,
  PVC_SURCHARGE,
  VINYL_DISCOUNT_FACTOR,
} from '../../src/components/manual-sale/manualSaleConstants.js';
import { createRemoteSaleSchema } from '../../server/validators/remoteSaleValidators.js';
import { prisma } from '../../server/config/prisma.js';
import { createRemoteSaleTransaction } from '../../server/services/sales/remoteSaleService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

async function loadModuleHeaderExports(relPath, splitMarker) {
  const fullPath = path.join(ROOT, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const splitIdx = source.indexOf(splitMarker);
  assert.ok(splitIdx > 0, `${relPath} debe contener "${splitMarker}"`);
  const headerOnly = source
    .slice(0, splitIdx)
    .replace(/^import\s+[^\n]*from\s+['"][^'"]+['"];?\r?\n/gm, '');
  const dataUrl = `data:text/javascript;base64,${Buffer.from(headerOnly, 'utf8').toString('base64')}`;
  return import(dataUrl);
}

const modalHelpers = await loadModuleHeaderExports(
  'src/components/manual-sale/CustomItemModal.jsx',
  'export default function CustomItemModal'
);
const remoteHookHelpers = await loadModuleHeaderExports(
  'src/components/manual-sale/hooks/useRemoteSaleForm.js',
  'export function useRemoteSaleForm'
);
const cardHelpers = await loadModuleHeaderExports(
  'src/components/production/ProductionOrderCard.jsx',
  'export default function ProductionOrderCard'
);

describe('feat-021: Medidas con Decimales (42.2 cm) y Paridad Matemática Exacta con Web Deco Vintage', () => {
  describe('1. Capa 1 (src/utils/customPosterPricing.js): Pureza Arquitectónica, parseDecimalCm y Validación', () => {
    it('1.1. customPosterPricing.js es 100% puro sin imports hacia capas superiores ni CRLF', () => {
      const utilPath = path.join(ROOT, 'src/utils/customPosterPricing.js');
      const content = fs.readFileSync(utilPath, 'utf8');
      assert.equal(content.includes('\r\n'), false, 'customPosterPricing.js debe tener 0 CRLF');
      assert.doesNotMatch(
        content,
        /^\s*import\s+/m,
        'Capa 1 utils no debe importar de services, hooks, context, components ni server'
      );
      assert.equal(CUSTOM_MIN_CM, 5);
      assert.equal(CUSTOM_MAX_CM, 300);
      assert.equal(CUSTOM_CM2_RATE, 0.048);
      assert.equal(WOOD_CUSTOM_CUT_SURCHARGE, 25.00);
      assert.equal(PVC_SURCHARGE, 15.00);
      assert.equal(VINYL_DISCOUNT_FACTOR, 0.50);
    });

    it('1.2. parseDecimalCm y formatDecimalCm normalizan punto y coma decimal sin pérdida de precisión', () => {
      assert.equal(parseDecimalCm('42.2'), 42.2);
      assert.equal(parseDecimalCm('42,2'), 42.2);
      assert.equal(parseDecimalCm('  48,50  '), 48.5);
      assert.equal(parseDecimalCm(68.25), 68.25);
      assert.equal(parseDecimalCm(''), 0);
      assert.equal(parseDecimalCm(null), 0);
      assert.equal(parseDecimalCm(undefined), 0);
      assert.equal(parseDecimalCm(false), 0);
      assert.equal(parseDecimalCm('abc'), 0);
      assert.equal(parseDecimalCm('Infinity'), 0);

      assert.equal(formatDecimalCm('42.2'), '42.2');
      assert.equal(formatDecimalCm('42,20'), '42.2');
      assert.equal(formatDecimalCm('30.00'), '30');
      assert.equal(formatDecimalCm('68.25'), '68.25');
      assert.equal(formatDecimalCm(''), '');
    });

    it('1.3. validateCustomDimensions permite decimales en [5, 300] cm y rechaza fuera de rango', () => {
      const okDot = validateCustomDimensions('42.2', '30');
      assert.equal(okDot.valid, true);
      assert.equal(okDot.widthCm, 42.2);
      assert.equal(okDot.heightCm, 30);

      const okComma = validateCustomDimensions('48,5', '68,25');
      assert.equal(okComma.valid, true);
      assert.equal(okComma.widthCm, 48.5);
      assert.equal(okComma.heightCm, 68.25);

      const tooSmall = validateCustomDimensions('4.99', '30');
      assert.equal(tooSmall.valid, false);
      assert.match(tooSmall.error, /entre 5 cm y 300 cm/);

      const tooLarge = validateCustomDimensions('42.2', '300.01');
      assert.equal(tooLarge.valid, false);
      assert.match(tooLarge.error, /entre 5 cm y 300 cm/);

      const emptyDims = validateCustomDimensions('', '30');
      assert.equal(emptyDims.valid, false);
      assert.match(emptyDims.error, /ancho y alto válidos/);
    });

    it('1.4. normalizePosterMaterial unifica códigos de Web Deco Vintage y Módulo de Ventas', () => {
      assert.equal(normalizePosterMaterial('mdf'), 'MDF_5_5MM');
      assert.equal(normalizePosterMaterial('MDF_5_5MM'), 'MDF_5_5MM');
      assert.equal(normalizePosterMaterial('pvc'), 'PVC_5MM');
      assert.equal(normalizePosterMaterial('PVC_5MM'), 'PVC_5MM');
      assert.equal(normalizePosterMaterial('vinyl_only'), 'VINILO_SOLO');
      assert.equal(normalizePosterMaterial('VINILO_SOLO'), 'VINILO_SOLO');
    });
  });

  describe('2. Vectores Dorados Compartidos con Web Deco Vintage (Paridad Exacta al Centavo)', () => {
    const GOLDEN_VECTORS = [
      {
        label: 'Vector 1: 42.2 x 30 cm MDF x1 -> Q 85.77',
        customWidth: '42.2',
        customHeight: '30',
        material: 'MDF_5_5MM',
        webAlias: 'mdf',
        quantity: 1,
        expectedArea: 1266,
        expectedBasePrint: 60.77,
        expectedUnitPrice: 85.77,
        expectedSubtotal: 85.77,
      },
      {
        label: 'Vector 2: 42.2 x 30 cm MDF x2 -> unit Q 85.77, subtotal Q 171.54',
        customWidth: '42.2',
        customHeight: '30',
        material: 'MDF_5_5MM',
        webAlias: 'mdf',
        quantity: 2,
        expectedArea: 1266,
        expectedBasePrint: 60.77,
        expectedUnitPrice: 85.77,
        expectedSubtotal: 171.54,
      },
      {
        label: 'Vector 3: 42.2 x 30 cm PVC x1 -> Q 75.77',
        customWidth: '42.2',
        customHeight: '30',
        material: 'PVC_5MM',
        webAlias: 'pvc',
        quantity: 1,
        expectedArea: 1266,
        expectedBasePrint: 60.77,
        expectedUnitPrice: 75.77,
        expectedSubtotal: 75.77,
      },
      {
        label: 'Vector 4: 42.2 x 30 cm Vinilo Solo x1 -> Q 30.38',
        customWidth: '42.2',
        customHeight: '30',
        material: 'VINILO_SOLO',
        webAlias: 'vinyl_only',
        quantity: 1,
        expectedArea: 1266,
        expectedBasePrint: 60.77,
        expectedUnitPrice: 30.38,
        expectedSubtotal: 30.38,
      },
      {
        label: 'Vector 5: 42.2 x 58.5 cm MDF x1 -> Q 143.50',
        customWidth: '42.2',
        customHeight: '58.5',
        material: 'MDF_5_5MM',
        webAlias: 'mdf',
        quantity: 1,
        expectedArea: 2468.7,
        expectedBasePrint: 118.50,
        expectedUnitPrice: 143.50,
        expectedSubtotal: 143.50,
      },
      {
        label: 'Vector 6: 48.5 x 68.25 cm MDF x3 -> unit Q 183.89, subtotal Q 551.67',
        customWidth: '48.5',
        customHeight: '68.25',
        material: 'MDF_5_5MM',
        webAlias: 'mdf',
        quantity: 3,
        expectedArea: 3310.13,
        expectedBasePrint: 158.89,
        expectedUnitPrice: 183.89,
        expectedSubtotal: 551.67,
      },
      {
        label: 'Vector 7: 40 x 50 cm MDF x1 -> Q 121.00',
        customWidth: '40',
        customHeight: '50',
        material: 'MDF_5_5MM',
        webAlias: 'mdf',
        quantity: 1,
        expectedArea: 2000,
        expectedBasePrint: 96.00,
        expectedUnitPrice: 121.00,
        expectedSubtotal: 121.00,
      },
    ];

    for (const vec of GOLDEN_VECTORS) {
      it(`2.1. ${vec.label} (con punto decimal, coma decimal y alias Web '${vec.webAlias}')`, () => {
        const resPos = calculateCustomPosterPrice({
          mode: 'CUSTOM',
          material: vec.material,
          customWidth: vec.customWidth,
          customHeight: vec.customHeight,
          quantity: vec.quantity,
        });
        assert.equal(resPos.area, vec.expectedArea);
        assert.equal(resPos.basePrint, vec.expectedBasePrint);
        assert.equal(resPos.unitPrice, vec.expectedUnitPrice);
        assert.equal(resPos.subtotal, vec.expectedSubtotal);
        assert.equal(resPos.totalPrice, vec.expectedSubtotal);

        // Equivalencia idéntica usando coma decimal y código de material de Web Deco Vintage
        const resWebComma = calculateCustomPosterPrice({
          mode: 'CUSTOM',
          material: vec.webAlias,
          customWidth: vec.customWidth.replace('.', ','),
          customHeight: vec.customHeight.replace('.', ','),
          quantity: vec.quantity,
        });
        assert.deepEqual(resWebComma, resPos);
      });
    }

    it('2.2. Modo STANDARD respeta precios precortados sin recargo Q25 en MDF, +Q15 en PVC y 50% en Vinilo', () => {
      const mediano = OFFICIAL_SIZES.find((s) => s.sizeId === 'MEDIANO');
      const mdfStd = calculateCustomPosterPrice({ mode: 'STANDARD', material: 'MDF_5_5MM', selectedSize: mediano, quantity: 2 });
      assert.equal(mdfStd.unitPrice, 65.00);
      assert.equal(mdfStd.subtotal, 130.00);

      const pvcStd = calculateCustomPosterPrice({ mode: 'STANDARD', material: 'PVC_5MM', selectedSize: mediano, quantity: 2 });
      assert.equal(pvcStd.unitPrice, 80.00);
      assert.equal(pvcStd.subtotal, 160.00);

      const vinylStd = calculateCustomPosterPrice({ mode: 'STANDARD', material: 'VINILO_SOLO', selectedSize: mediano, quantity: 2 });
      assert.equal(vinylStd.unitPrice, 32.50);
      assert.equal(vinylStd.subtotal, 65.00);
    });
  });

  describe('3. CustomItemModal.jsx, Transacción Remota y Badge Móvil en Taller (ProductionOrderCard.jsx)', () => {
    const modalPath = path.join(ROOT, 'src/components/manual-sale/CustomItemModal.jsx');
    const cardPath = path.join(ROOT, 'src/components/production/ProductionOrderCard.jsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');
    const cardContent = fs.readFileSync(cardPath, 'utf8');

    it('3.1. CustomItemModal.jsx habilita step="0.01" e inputMode="decimal" en Ancho y Alto respetando <= 280L y 0 CRLF', () => {
      const stepMatches = modalContent.match(/min="5"\s+max="300"\s+step="0\.01"\s+inputMode="decimal"/g) || [];
      assert.equal(
        stepMatches.length,
        2,
        'Tanto Ancho como Alto deben declarar min="5" max="300" step="0.01" inputMode="decimal"'
      );
      assert.ok(modalContent.includes('calculateCustomPosterPrice('), 'CustomItemModal debe consumir calculateCustomPosterPrice');
      assert.ok(modalContent.includes('validateCustomDimensions('), 'CustomItemModal debe validar medidas decimales con validateCustomDimensions');
      assert.ok(
        modalContent.includes('`Especial: ${formatDecimalCm(customWidth)} x ${formatDecimalCm(customHeight)} cm (Corte Taller)`'),
        'CustomItemModal debe preservar decimales exactos en customDimensions'
      );
      assert.ok(modalContent.split('\n').length <= 280, 'CustomItemModal.jsx debe mantenerse <= 280 líneas');
      assert.ok(!/amber-|orange-/.test(modalContent), 'Cero clases amber/orange en CustomItemModal.jsx');
      assert.equal(modalContent.includes('\r\n'), false, 'CustomItemModal.jsx debe tener 0 CRLF');
      assert.equal(cardContent.includes('\r\n'), false, 'ProductionOrderCard.jsx debe tener 0 CRLF');
    });

    it('3.2. Flujo completo: 42.2 x 30 cm MDF x2 (Q 171.54) genera payload, carrito, validación Zod y transacción exacta', async () => {
      const calc = calculateCustomPosterPrice({
        mode: 'CUSTOM',
        material: 'MDF_5_5MM',
        customWidth: '42.2',
        customHeight: '30',
        quantity: 2,
      });
      const customDimensions = `Especial: ${formatDecimalCm('42.2')} x ${formatDecimalCm('30')} cm (Corte Taller)`;
      assert.equal(customDimensions, 'Especial: 42.2 x 30 cm (Corte Taller)');

      const payloads = modalHelpers.buildCustomItemPayloads({
        description: 'Retrato Boda Medida Decimal',
        material: 'MDF_5_5MM',
        customDimensions,
        unitPrice: calc.unitPrice,
        quantity: 2,
        uploadedArts: [{ id: 'art-dec-1', url: 'https://storage.googleapis.com/deko/boda-42-2.webp' }],
      });
      assert.equal(payloads.length, 1);

      const cartItem = remoteHookHelpers.createCartCustomItem(payloads[0]);
      assert.equal(cartItem.unitPrice, 85.77);
      assert.equal(cartItem.subtotal, 171.54);
      assert.equal(cartItem.customDimensions, 'Especial: 42.2 x 30 cm (Corte Taller)');

      const totals = remoteHookHelpers.calculateRemoteOrderTotals({
        cartItems: [cartItem],
        discount: 0,
        editionCost: 0,
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35,
      });
      assert.equal(totals.productsAmount, 171.54);
      assert.equal(totals.totalAmount, 206.54);

      const parsed = createRemoteSaleSchema.parse({
        eventId: 'evt-ventas-redes-online',
        customer: {
          fullName: 'Andrea Castillo',
          phone: '50255889900',
          deliveryAddress: 'Zona 15 Vista Hermosa',
          department: 'Guatemala',
          municipality: 'Guatemala',
          sourceChannel: 'WHATSAPP',
        },
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35,
        shippingCourier: 'GUATEX',
        items: [
          {
            productId: null,
            description: cartItem.description,
            quantity: cartItem.quantity,
            unitPrice: cartItem.unitPrice,
            isCustom: true,
            material: cartItem.material,
            customDimensions: cartItem.customDimensions,
            customImageUrl: cartItem.customImageUrl,
          },
        ],
        payments: [{ method: 'TRANSFERENCIA', amount: 100, reference: 'BOL-DEC-021' }],
        discount: 0,
      });

      let persistedSale = null;
      const mockTx = {
        sale: {
          findFirst: async () => null,
          create: async ({ data }) => {
            persistedSale = data;
            return { id: 'sale-dec-021', ...data, items: data.items.create, payments: data.payments.create };
          },
        },
        customer: {
          findUnique: async () => null,
          findFirst: async () => null,
          create: async ({ data }) => ({ id: 'cust-dec-021', ...data }),
          update: async ({ data }) => ({ id: 'cust-dec-021', ...data }),
        },
        event: {
          findUnique: async () => ({ id: 'evt-ventas-redes-online', name: 'Ventas en Línea' }),
          update: async () => ({ name: 'REDES', currentSaleSequence: 21 }),
        },
        auditLog: { create: async () => ({}) },
      };

      const origTx = prisma.$transaction;
      prisma.$transaction = async (fn) => fn(mockTx);
      try {
        await createRemoteSaleTransaction({
          tenantId: 'tenant-deko',
          sellerId: 'seller-redes-01',
          data: parsed,
        });
        assert.equal(persistedSale.items.create[0].unitPrice, 85.77);
        assert.equal(persistedSale.items.create[0].subtotal, 171.54);
        assert.equal(persistedSale.totalAmount, 206.54);
        assert.equal(persistedSale.balanceDue, 106.54);
        assert.equal(persistedSale.items.create[0].customDimensions, 'Especial: 42.2 x 30 cm (Corte Taller)');
      } finally {
        prisma.$transaction = origTx;
      }
    });

    it('3.3. extractPosterSizeInfo en ProductionOrderCard.jsx muestra medidas con decimales sin truncar en Taller', () => {
      const fromCustomDims = cardHelpers.extractPosterSizeInfo({
        description: 'Personalizado: Retrato Boda Medida Decimal (MDF_5_5MM, Especial: 42.2 x 30 cm (Corte Taller))',
        isCustom: true,
        customDimensions: 'Especial: 42.2 x 30 cm (Corte Taller)',
      });
      assert.equal(fromCustomDims.sizeLabel, 'Especial: 42.2 x 30 cm (Corte Taller)');
      assert.equal(fromCustomDims.displayTitle, 'Personalizado: Retrato Boda Medida Decimal');

      const fromTrailingDecimalParens = cardHelpers.extractPosterSizeInfo({
        description: 'Póster Arquitectónico (48.5 x 68.25 cm)',
        isCustom: true,
        customDimensions: null,
      });
      assert.equal(fromTrailingDecimalParens.sizeLabel, '48.5 x 68.25 cm');
      assert.equal(fromTrailingDecimalParens.displayTitle, 'Póster Arquitectónico');

      const fromNestedDecimalParens = cardHelpers.extractPosterSizeInfo({
        description: 'Obra Personalizada (Especial: 42.2 × 58.5 cm (Corte Taller))',
        isCustom: true,
        customDimensions: '',
      });
      assert.equal(fromNestedDecimalParens.sizeLabel, 'Especial: 42.2 × 58.5 cm (Corte Taller)');
      assert.equal(fromNestedDecimalParens.displayTitle, 'Obra Personalizada');

      const fromInlineDecimalCm = cardHelpers.extractPosterSizeInfo({
        description: 'Lámina Especial 42.2 x 30 cm',
        isCustom: true,
        customDimensions: null,
      });
      assert.equal(fromInlineDecimalCm.sizeLabel, '42.2 x 30 cm');
    });
  });
});
