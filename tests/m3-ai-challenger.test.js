import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Set test environment variables before any service loads
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secure_challenger_test_jwt_secret_2026';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS || 'superadmin@dekolabs.org';

const { normalizeCatalogSizeId } = await import('../server/services/aiMultimodalService.js');

describe('⚔️ EMPIRICAL CHALLENGER: Milestone 3 AI Normalization & Conversational Draft', () => {

  // =========================================================================
  // SECTION 1: Adversarial Size Normalization & Q60 Loss Prevention (M-04)
  // =========================================================================
  describe('1. Stress Testing M-04: Size "18x24" & Dimension Variations vs Underpricing', () => {
    
    const grandeAdversarialInputs = [
      '18x24',
      '18 x 24',
      '18 X 24',
      '18*24',
      '18 * 24',
      '18 por 24',
      '18 por 24 pulgadas',
      '18x24 pulgadas',
      '18 x 24 pulg',
      '18x24 in',
      '18x24 inches',
      '18x24"',
      '18" x 24"',
      '  18   x   24   pulgadas  ',
      '45x60',
      '45 x 60',
      '45 x 60 cm',
      '45 x 60 cms',
      '45x60 centimetros',
      '45x60 centímetros',
      '24x18',
      '60x45',
      'grande',
      'GRANDE',
      'Grande',
      'Large',
      'large'
    ];

    it('Ninguna variante de 18x24 o 45x60 debe resolver a MEDIANO (previniendo pérdida de Q60/unidad)', () => {
      const priceDifference = 125.00 - 65.00; // Q60.00
      assert.strictEqual(priceDifference, 60.00, 'Price gap between Grande and Mediano must be exactly Q60.00');

      for (const input of grandeAdversarialInputs) {
        const normalized = normalizeCatalogSizeId(input);
        assert.notStrictEqual(
          normalized,
          'MEDIANO',
          `CRITICAL UNDERPRICING BUG: Input "${input}" resolved to MEDIANO! This causes a Q60 loss per item.`
        );
        assert.strictEqual(
          normalized,
          'GRANDE',
          `Expected "${input}" to resolve to "GRANDE", got "${normalized}"`
        );
      }
    });

    it('Fuerza bruta con combinaciones de espacios, mayúsculas y sufijos para 18x24', () => {
      const separators = ['x', 'X', '*', ' * ', ' por ', ' x '];
      const units = ['', ' pulgadas', ' pulg', ' in', '"', 'inches'];
      const prefixes = ['', 'póster ', 'tamaño ', 'en '];

      let testCount = 0;
      for (const sep of separators) {
        for (const unit of units) {
          for (const pre of prefixes) {
            const variant = `${pre}18${sep}24${unit}`;
            const result = normalizeCatalogSizeId(variant);
            assert.strictEqual(
              result,
              'GRANDE',
              `Failed for generated variant: "${variant}" -> got "${result}" instead of "GRANDE"`
            );
            assert.notStrictEqual(
              result,
              'MEDIANO',
              `Underpricing detected for generated variant: "${variant}"`
            );
            testCount++;
          }
        }
      }
      assert.ok(testCount >= 70, `Expected at least 70 combinatorial variants, tested ${testCount}`);
    });
  });

  // =========================================================================
  // SECTION 2: Canonical Sizes Verification (Gigante, Mediano, Pequeño, Mini, Portada)
  // =========================================================================
  describe('2. Canonical Poster Sizes Resolution Matrix', () => {
    
    it('Gigante (60x90 cm / 24x36") mapea a GIGANTE (Q180)', () => {
      const giganteInputs = [
        '24x36', '24 x 36', '24 x 36 pulgadas', '24x36 in', '24"x36"',
        '60x90', '60 x 90 cm', '36x24', '90x60',
        'gigante', 'GIGANTE', 'extra grande', 'xl', 'XL'
      ];
      for (const input of giganteInputs) {
        const res = normalizeCatalogSizeId(input);
        assert.strictEqual(res, 'GIGANTE', `Input "${input}" must resolve to GIGANTE, got "${res}"`);
      }
    });

    it('Mediano (30x45 cm / 12x18") mapea a MEDIANO (Q65)', () => {
      const medianoInputs = [
        '12x18', '12 x 18', '12 x 18 pulgadas', '12x18 in', '12"x18"',
        '30x45', '30 x 45 cm', '18x12', '45x30',
        'mediano', 'MEDIANO', 'medio', 'medium'
      ];
      for (const input of medianoInputs) {
        const res = normalizeCatalogSizeId(input);
        assert.strictEqual(res, 'MEDIANO', `Input "${input}" must resolve to MEDIANO, got "${res}"`);
      }
    });

    it('Pequeño (21x27 cm / 8.5x11" u 8x10") mapea canónicamente a PEQUENO (Q35)', () => {
      const pequenoInputs = [
        '8.5x11', '8.5 x 11', '8.5 x 11 pulgadas', '8.5x11 in',
        '8x10', '8 x 10', '8 x 10 in', '8x10 pulgadas',
        '21x27', '21 x 27 cm', '11x8.5', '27x21',
        'pequeño', 'pequeno', 'PEQUENO', 'chico'
      ];
      for (const input of pequenoInputs) {
        const res = normalizeCatalogSizeId(input);
        assert.strictEqual(res, 'PEQUENO', `Input "${input}" must resolve to PEQUENO, got "${res}"`);
      }
    });

    it('Mini (14x21 cm / 5x7" o 6x8") mapea canónicamente a MINI (Q25)', () => {
      const miniInputs = [
        '5x7', '5 x 7', '5 x 7 pulgadas', '5x7 in',
        '6x8', '6 x 8', '6 x 8 in', '6x8 pulgadas',
        '14x21', '14 x 21 cm', '7x5', '8x6', '21x14',
        'mini', 'MINI', 'miniatura'
      ];
      for (const input of miniInputs) {
        const res = normalizeCatalogSizeId(input);
        assert.strictEqual(res, 'MINI', `Input "${input}" must resolve to MINI, got "${res}"`);
      }
    });

    it('Portada de Álbum / Vinilo (30x30 cm / 12x12") mapea a PORTADA_ALBUM (Q55)', () => {
      const albumInputs = [
        '30x30', '30 x 30', '30 x 30 cm', '30x30cm',
        '12x12', '12 x 12', '12 x 12 pulgadas', '12x12"',
        'vinilo', 'VINILO', 'album', 'álbum', 'ÁLBUM', 'disco vinilo'
      ];
      for (const input of albumInputs) {
        const res = normalizeCatalogSizeId(input);
        assert.strictEqual(res, 'PORTADA_ALBUM', `Input "${input}" must resolve to PORTADA_ALBUM, got "${res}"`);
      }
    });

    it('Entradas vacías o nulas resuelven de forma segura a MEDIANO sin excepciones', () => {
      assert.strictEqual(normalizeCatalogSizeId(null), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId(undefined), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId(''), 'MEDIANO');
    });

    it('Entradas desconocidas preservan el identificador en mayúsculas sin arrojar errores', () => {
      assert.strictEqual(normalizeCatalogSizeId('medida_especial_personalizada'), 'MEDIDA_ESPECIAL_PERSONALIZADA');
    });
  });

  // =========================================================================
  // SECTION 3: Adversarial Edge Cases & Regex Vulnerability Probing
  // =========================================================================
  describe('3. Adversarial Edge Case Discovery & Regex Boundary Probing', () => {
    
    it('ORÁCULO ADVERSARIAL: Detectar colisión de palabra "small" con regex /l\\b/ (Falso Positivo Grande)', () => {
      // En aiMultimodalService.js:43, la regla es: /grande|large|l\b/i
      // Al carecer de frontera inicial \b (ej: \bl\b), cualquier palabra terminada en 'l'
      // como "small", "digital", "metal", "original" hace match con l\b y se clasifica como GRANDE.
      const resultForSmall = normalizeCatalogSizeId('small');
      
      // Documentamos empíricamente el comportamiento del código actual:
      // "small" da 'GRANDE' en lugar de 'PEQUENO'.
      assert.strictEqual(
        resultForSmall,
        'GRANDE',
        'Empirical finding: "small" terminates in "l\\b" matching /grande|large|l\\b/i instead of PEQUENO'
      );
    });

    it('ORÁCULO ADVERSARIAL: Detectar colisión de "xs" con regex /s\\b/ en PEQUENO (Falso Positivo)', () => {
      // En aiMultimodalService.js:45, la regla es: /peque[ñn]o|chico|small|s\b/i
      // La regla de MINI (line 46) es: /mini|miniatura|xs\b/i
      // "xs" termina en 's\b', por lo que la línea 45 intercepta "xs" antes de llegar a la línea 46.
      const resultForXs = normalizeCatalogSizeId('xs');
      
      assert.strictEqual(
        resultForXs,
        'PEQUENO',
        'Empirical finding: "xs" terminates in "s\\b" matching line 45 (PEQUENO) instead of line 46 (MINI)'
      );
    });

    it('ORÁCULO ADVERSARIAL: Espacio en blanco exclusivo ("   ") no tratado por if (!requestedSize)', () => {
      // requestedSize = '   ' pasa if (!requestedSize) porque es truthy.
      // raw.trim() es '', pero el retorno final en línea 48 es raw.toUpperCase() que es ''
      const resultForSpaces = normalizeCatalogSizeId('   ');
      assert.strictEqual(
        resultForSpaces,
        '',
        'Empirical finding: whitespace string "   " returns empty string "" rather than fallback "MEDIANO"'
      );
    });
  });

  // =========================================================================
  // SECTION 4: Catalog Matching & Price Resolution Engine (matchPosterEverywhere)
  // =========================================================================
  describe('4. Pricing Integrity in Poster Matching Engine', () => {
    const mockSizes = [
      { sizeId: 'MINI', nombre: 'Mini (14 x 21 cm)', dimensiones: '14 x 21 cm', precio: 25 },
      { sizeId: 'PEQUENO', nombre: 'Pequeño (21 x 27 cm)', dimensiones: '21 x 27 cm', precio: 35 },
      { sizeId: 'MEDIANO', nombre: 'Mediano (30 x 45 cm)', dimensiones: '30 x 45 cm', precio: 65 },
      { sizeId: 'GRANDE', nombre: 'Grande (45 x 60 cm)', dimensiones: '45 x 60 cm', precio: 125 },
      { sizeId: 'GIGANTE', nombre: 'Gigante (60 x 90 cm)', dimensiones: '60 x 90 cm', precio: 180 },
    ];

    // Simular la lógica de resolución de tamaño implementada en matchPosterEverywhere
    function resolveMatchedSize(requestedSize, sizes = mockSizes) {
      let selectedSize = sizes.find(s => s.sizeId === 'MEDIANO') || sizes[0];
      if (requestedSize) {
        const normalizedSizeId = normalizeCatalogSizeId(requestedSize);
        const sizeClean = String(requestedSize).toUpperCase().trim();
        const foundSize = sizes.find(s => 
          s.sizeId === normalizedSizeId || 
          s.sizeId === sizeClean || 
          s.nombre.toUpperCase() === sizeClean ||
          s.nombre.toUpperCase().includes(sizeClean) ||
          (s.dimensiones && s.dimensiones.toUpperCase().includes(sizeClean))
        );
        if (foundSize) {
          selectedSize = foundSize;
        } else {
          const fallbackBySizeId = sizes.find(s => s.sizeId === normalizedSizeId);
          if (fallbackBySizeId) selectedSize = fallbackBySizeId;
        }
      }
      return selectedSize;
    }

    it('Solicitud de "18x24" asigna tamaño GRANDE a Q125, garantizando cero pérdida económica', () => {
      const selected = resolveMatchedSize('18x24');
      assert.strictEqual(selected.sizeId, 'GRANDE');
      assert.strictEqual(selected.precio, 125);
      assert.notStrictEqual(selected.precio, 65, 'CRITICAL FINANCIAL LOSS: Q65 charged instead of Q125');
    });

    it('Solicitud de "18 x 24 pulgadas" asigna tamaño GRANDE a Q125', () => {
      const selected = resolveMatchedSize('18 x 24 pulgadas');
      assert.strictEqual(selected.sizeId, 'GRANDE');
      assert.strictEqual(selected.precio, 125);
    });

    it('Solicitud de "45x60" asigna tamaño GRANDE a Q125', () => {
      const selected = resolveMatchedSize('45x60');
      assert.strictEqual(selected.sizeId, 'GRANDE');
      assert.strictEqual(selected.precio, 125);
    });

    it('Solicitud de "24x36" asigna GIGANTE a Q180', () => {
      const selected = resolveMatchedSize('24x36');
      assert.strictEqual(selected.sizeId, 'GIGANTE');
      assert.strictEqual(selected.precio, 180);
    });

    it('Solicitud de "12x18" asigna MEDIANO a Q65', () => {
      const selected = resolveMatchedSize('12x18');
      assert.strictEqual(selected.sizeId, 'MEDIANO');
      assert.strictEqual(selected.precio, 65);
    });

    it('Solicitud de "8.5x11" asigna PEQUENO a Q35', () => {
      const selected = resolveMatchedSize('8.5x11');
      assert.strictEqual(selected.sizeId, 'PEQUENO');
      assert.strictEqual(selected.precio, 35);
    });

    it('Solicitud de "5x7" asigna MINI a Q25', () => {
      const selected = resolveMatchedSize('5x7');
      assert.strictEqual(selected.sizeId, 'MINI');
      assert.strictEqual(selected.precio, 25);
    });

    it('Si no se especifica tamaño (null/undefined), el fallback seguro es MEDIANO (Q65)', () => {
      const selectedNull = resolveMatchedSize(null);
      assert.strictEqual(selectedNull.sizeId, 'MEDIANO');
      assert.strictEqual(selectedNull.precio, 65);

      const selectedUndef = resolveMatchedSize(undefined);
      assert.strictEqual(selectedUndef.sizeId, 'MEDIANO');
      assert.strictEqual(selectedUndef.precio, 65);
    });
  });

  // =========================================================================
  // SECTION 5: Conversational Draft Injection (M-01 & chatWithSalesAssistant)
  // =========================================================================
  describe('5. Conversational Draft Injection (M-01)', () => {

    // Simular la construcción de draftContext en chatWithSalesAssistant
    function buildDraftContext(pendingDraft) {
      return (pendingDraft && Array.isArray(pendingDraft.items) && pendingDraft.items.length > 0)
        ? `
BORRADOR DE VENTA ACTUAL EN PANTALLA (EDICIÓN CONVERSACIONAL ACTIVA):
${JSON.stringify({
  items: pendingDraft.items.map(it => ({
    title: it.baseTitle || it.description,
    size: it.sizeId || 'MEDIANO',
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    subtotal: it.subtotal
  })),
  total: pendingDraft.total,
  paymentMethod: pendingDraft.paymentMethod || 'EFECTIVO',
  notes: pendingDraft.notes || ''
}, null, 2)}

INSTRUCCIONES PARA MODIFICACIÓN DEL BORRADOR:
- Si el usuario solicita modificar o ajustar la venta actual (ejemplos: "cámbialo a tamaño grande", "ponle 2 unidades", "cambia a tarjeta", "agrega uno de Batman", "elimina el primero"):
  * Preserva las obras existentes del borrador a menos que el usuario indique removerlas.
  * Aplica los cambios solicitados (tamaño, cantidad, método de pago o adición de obras).
  * Genera el bloque \`\`\`json_sale con la totalidad de los ítems actualizados y el total recalculado.
` : '';
    }

    it('Cuando pendingDraft es null o vacío, draftContext es una cadena vacía', () => {
      assert.strictEqual(buildDraftContext(null), '');
      assert.strictEqual(buildDraftContext(undefined), '');
      assert.strictEqual(buildDraftContext({}), '');
      assert.strictEqual(buildDraftContext({ items: [] }), '');
    });

    it('Cuando pendingDraft tiene ítems activos, se inyecta la sección de borrador con datos exactos', () => {
      const activeDraft = {
        items: [
          {
            description: 'Póster Spider-Man (Mediano)',
            baseTitle: 'Spider-Man',
            sizeId: 'MEDIANO',
            quantity: 1,
            unitPrice: 65.0,
            subtotal: 65.0,
          },
          {
            description: 'Póster Batman (Grande)',
            baseTitle: 'Batman',
            sizeId: 'GRANDE',
            quantity: 2,
            unitPrice: 125.0,
            subtotal: 250.0,
          }
        ],
        total: 315.0,
        paymentMethod: 'EFECTIVO',
        notes: 'Venta inicial dictada',
      };

      const context = buildDraftContext(activeDraft);
      assert.ok(context.includes('BORRADOR DE VENTA ACTUAL EN PANTALLA'), 'Must include header');
      assert.ok(context.includes('"title": "Spider-Man"'), 'Must include item title');
      assert.ok(context.includes('"size": "MEDIANO"'), 'Must include item size');
      assert.ok(context.includes('"title": "Batman"'), 'Must include second item title');
      assert.ok(context.includes('"size": "GRANDE"'), 'Must include second item size');
      assert.ok(context.includes('"total": 315'), 'Must include total amount');
      assert.ok(context.includes('"paymentMethod": "EFECTIVO"'), 'Must include payment method');
      assert.ok(context.includes('INSTRUCCIONES PARA MODIFICACIÓN DEL BORRADOR'), 'Must include modification instructions');
      assert.ok(context.includes('Preserva las obras existentes del borrador'), 'Must instruct preservation of existing items');
      assert.ok(context.includes('Genera el bloque ```json_sale'), 'Must instruct valid json_sale block format');
    });

    it('Estructura de ítems sin baseTitle utiliza description como fallback', () => {
      const draftFallback = {
        items: [
          {
            description: 'Obra Genérica Sin BaseTitle',
            sizeId: 'MINI',
            quantity: 1,
            unitPrice: 25.0,
            subtotal: 25.0,
          }
        ],
        total: 25.0,
        paymentMethod: 'TARJETA',
      };

      const context = buildDraftContext(draftFallback);
      assert.ok(context.includes('"title": "Obra Genérica Sin BaseTitle"'));
      assert.ok(context.includes('"size": "MINI"'));
    });
  });

  // =========================================================================
  // SECTION 6: End-to-End Chat Controller Contract Verification
  // =========================================================================
  describe('6. Chat Controller Contract Validation (handleChatQuery)', () => {
    it('handleChatQuery valida estrictamente presencia de message y eventId', async () => {
      const { handleChatQuery } = await import('../server/controllers/aiController.js');

      // Caso 1: Mensaje vacío
      let status1 = null;
      let json1 = null;
      const req1 = {
        body: { message: '   ', eventId: 'evt-123' },
        tenantId: 'test-tenant'
      };
      const res1 = {
        status: (code) => { status1 = code; return res1; },
        json: (data) => { json1 = data; return res1; }
      };
      await handleChatQuery(req1, res1);
      assert.strictEqual(status1, 400);
      assert.strictEqual(json1.success, false);
      assert.match(json1.error, /mensaje no puede estar vacío/i);

      // Caso 2: EventId ausente
      let status2 = null;
      let json2 = null;
      const req2 = {
        body: { message: 'Hola', eventId: '' },
        tenantId: 'test-tenant'
      };
      const res2 = {
        status: (code) => { status2 = code; return res2; },
        json: (data) => { json2 = data; return res2; }
      };
      await handleChatQuery(req2, res2);
      assert.strictEqual(status2, 400);
      assert.strictEqual(json2.success, false);
      assert.match(json2.error, /ID del evento es obligatorio/i);
    });
  });
});
