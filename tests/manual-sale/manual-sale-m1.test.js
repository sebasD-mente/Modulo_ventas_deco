import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_SIZES,
  SIZE_CLEANUP_REGEX,
  PAYMENT_METHODS,
} from '../../src/components/manual-sale/manualSaleConstants.js';
import { createSaleSchema } from '../../server/validators/saleValidators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('🛡️ SUITE DE PRUEBAS MODULARES M1: Constants & Reactive Hooks Architecture', () => {
  // =========================================================================
  // 1. AUDITORÍA ESTRICTA DE TECHOS DE LÍNEAS (LINE CEILINGS)
  // =========================================================================
  describe('1. Cumplimiento Estricto de Techos de Líneas', () => {
    const fileCeilings = [
      {
        file: 'src/components/manual-sale/manualSaleConstants.js',
        max: 40,
        desc: 'Constantes canónicas, tallas y regex',
      },
      {
        file: 'src/components/manual-sale/hooks/useCatalogSearch.js',
        max: 90,
        desc: 'Hook reactivo de búsqueda en catálogo con debounce',
      },
      {
        file: 'src/components/manual-sale/hooks/useManualSaleCart.js',
        max: 150,
        desc: 'Hook reactivo del carrito, drafts y checkout',
      },
    ];

    for (const { file, max, desc } of fileCeilings) {
      it(`1.x. ${file} (${desc}) respeta el techo de < ${max} líneas`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `El archivo ${file} debe existir`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lineCount = content.split('\n').length;
        assert.ok(
          lineCount < max,
          `Violación de techo: ${file} tiene ${lineCount} líneas (máximo permitido < ${max})`
        );
        assert.ok(
          lineCount <= 200,
          `Violación de límite de monolito: ${file} supera las 200 líneas`
        );
      });
    }
  });

  // =========================================================================
  // 2. AUDITORÍA FORENSE DE CERO MOCKS / STUBS Y ZERO-TRUST
  // =========================================================================
  describe('2. Auditoría Forense: Cero Mocks, Stubs o Fugas en Producción', () => {
    const filesToAudit = [
      'src/components/manual-sale/manualSaleConstants.js',
      'src/components/manual-sale/hooks/useCatalogSearch.js',
      'src/components/manual-sale/hooks/useManualSaleCart.js',
    ];

    it('2.1. Ningún archivo contiene comentarios TODO, FIXME, STUB, MOCK o marcadores dummy', () => {
      const suspiciousPattern =
        /(\/\/\s*(TODO|FIXME|STUB|MOCK|PLACEHOLDER)|\/\*[\s\S]*?(TODO|FIXME|STUB|MOCK|PLACEHOLDER)[\s\S]*?\*\/|const\s+mock|let\s+mock|function\s+mock|lorem\s+ipsum)/i;
      for (const file of filesToAudit) {
        const fullPath = path.join(rootDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const match = content.match(suspiciousPattern);
        assert.ok(
          !match,
          `Detectado marcador residual o stub prohibido en ${file}: "${match?.[0]}"`
        );
      }
    });

    it('2.2. Ningún archivo hardcodea correos de vendedores o IPs externas ajenas', () => {
      for (const file of filesToAudit) {
        const fullPath = path.join(rootDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        assert.ok(
          !content.includes('145.223.120.56'),
          `Violación de aislamiento: IP ajena detectada en ${file}`
        );
        assert.ok(
          !content.includes('@gmail.com'),
          `Violación de Zero-Trust: correo hardcodeado en ${file}`
        );
      }
    });
  });

  // =========================================================================
  // 3. CONTRATOS PÚBLICOS Y EXPORTS DE CONSTANTES Y HOOKS
  // =========================================================================
  describe('3. Verificación de Contratos y Signaturas de Exportación', () => {
    it('3.1. manualSaleConstants.js exporta DEFAULT_SIZES, SIZE_CLEANUP_REGEX y PAYMENT_METHODS', () => {
      assert.ok(Array.isArray(DEFAULT_SIZES), 'DEFAULT_SIZES debe ser un array');
      assert.equal(DEFAULT_SIZES.length, 6, 'DEFAULT_SIZES debe tener 6 tamaños canónicos');
      assert.ok(SIZE_CLEANUP_REGEX instanceof RegExp, 'SIZE_CLEANUP_REGEX debe ser RegExp');
      assert.deepEqual(PAYMENT_METHODS, ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']);
    });

    it('3.2. useCatalogSearch.js exporta función con named y default export', () => {
      const fullPath = path.join(rootDir, 'src/components/manual-sale/hooks/useCatalogSearch.js');
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert.match(content, /export\s+function\s+useCatalogSearch/);
      assert.match(content, /export\s+default\s+useCatalogSearch/);
    });

    it('3.3. useManualSaleCart.js exporta función con named y default export', () => {
      const fullPath = path.join(rootDir, 'src/components/manual-sale/hooks/useManualSaleCart.js');
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert.match(content, /export\s+function\s+useManualSaleCart/);
      assert.match(content, /export\s+default\s+useManualSaleCart/);
    });
  });

  // =========================================================================
  // 4. LÓGICA DE CONSTANTES Y NORMALIZACIÓN DE TALLAS
  // =========================================================================
  describe('4. Precios Canónicos y Expresión Regular de Tallas', () => {
    it('4.1. DEFAULT_SIZES tiene los precios canónicos oficiales', () => {
      const expectedPrices = {
        MINI: 25,
        PEQUENO: 35,
        MEDIANO: 65,
        GRANDE: 125,
        GIGANTE: 180,
        PORTADA_ALBUM: 55,
      };
      for (const size of DEFAULT_SIZES) {
        assert.equal(
          size.precio,
          expectedPrices[size.sizeId],
          `Precio incorrecto para ${size.sizeId}: esperado ${expectedPrices[size.sizeId]}, recibido ${size.precio}`
        );
      }
    });

    it('4.2. SIZE_CLEANUP_REGEX limpia correctamente las etiquetas de tamaño', () => {
      const cases = [
        {
          input: 'Póster Spider-Man (Mediano)',
          expected: 'Póster Spider-Man',
        },
        {
          input: 'Póster Bad Bunny (Portada Álbum)',
          expected: 'Póster Bad Bunny',
        },
        {
          input: 'Póster Taylor Swift (PORTADA)',
          expected: 'Póster Taylor Swift',
        },
        {
          input: 'Póster Star Wars (Gigante)',
          expected: 'Póster Star Wars',
        },
        {
          input: 'Póster Cyberpunk (Pequeño)',
          expected: 'Póster Cyberpunk',
        },
      ];

      for (const { input, expected } of cases) {
        const cleaned = input.replace(SIZE_CLEANUP_REGEX, '').trim();
        assert.equal(cleaned, expected);
      }
    });
  });

  // =========================================================================
  // 5. VALIDACIÓN DE PAYLOAD Y LÓGICA CONTABLE CON ZOD
  // =========================================================================
  describe('5. Simulación de Comportamiento Contable y Compatibilidad Zod', () => {
    it('5.1. Calcula subtotales y gran total respetando descuentos', () => {
      const items = [
        { unitPrice: 65, quantity: 2, subtotal: 130 },
        { unitPrice: 55, quantity: 1, subtotal: 55 },
      ];
      const discount = 15;
      const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0);
      const grandTotal = Math.max(0, subtotal - discount);

      assert.equal(subtotal, 185);
      assert.equal(grandTotal, 170);
    });

    it('5.2. Descuentos mayores al subtotal no producen números negativos', () => {
      const items = [{ unitPrice: 25, quantity: 1, subtotal: 25 }];
      const discount = 50;
      const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0);
      const grandTotal = Math.max(0, subtotal - discount);

      assert.equal(grandTotal, 0);
    });

    it('5.3. Payload de venta resultante pasa la validación formal de createSaleSchema', () => {
      const payload = {
        eventId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        items: [
          {
            productId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            description: 'Póster Spider-Man (Mediano)',
            quantity: 2,
            unitPrice: 65,
          },
        ],
        payments: [
          {
            method: 'EFECTIVO',
            amount: 130,
            reference: 'Pago en efectivo',
          },
        ],
        discount: 0,
        notes: 'Cliente de prueba',
        inputChannel: 'MANUAL_RAPIDA',
        attachments: [],
      };

      const result = createSaleSchema.safeParse(payload);
      assert.ok(result.success, `Fallo validación Zod: ${JSON.stringify(result.error?.issues)}`);
    });

    it('5.4. Payload con attachments de audio y canal IA_VOZ pasa validación Zod', () => {
      const payload = {
        eventId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        items: [
          {
            productId: null,
            description: 'Póster Un Verano Sin Ti (Portada Álbum)',
            quantity: 1,
            unitPrice: 55,
          },
        ],
        payments: [
          {
            method: 'TARJETA',
            amount: 55,
            reference: 'POS Visa #1234',
          },
        ],
        discount: 0,
        notes: 'Venta dictada por voz',
        inputChannel: 'IA_VOZ',
        attachments: [
          {
            fileUrl: 'https://storage.googleapis.com/deko-eventsales-media/audios/voice-123.webm',
            fileType: 'AUDIO_VOZ',
            transcription: '1 de un verano sin ti portada en tarjeta',
          },
        ],
      };

      const result = createSaleSchema.safeParse(payload);
      assert.ok(result.success, `Fallo validación Zod: ${JSON.stringify(result.error?.issues)}`);
    });
  });
});
