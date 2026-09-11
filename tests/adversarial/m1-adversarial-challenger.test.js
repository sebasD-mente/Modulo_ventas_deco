import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// Set dummy envs so server modules can be imported safely
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'super_secure_forensic_auditor_secret_key_2026';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = 'superadmin@dekolabs.org';

import {
  extractPaymentMethod,
  resolveEntityAlias,
  normalizeArtworkQuery,
  parseStandIntent,
  STAND_ENTITY_ALIASES,
} from '../../server/services/semanticParserService.js';
import {
  normalizeCatalogSizeId,
  constructDraftPayload,
} from '../../server/services/aiMultimodalService.js';
import {
  deduplicatePosters,
  extractImageSlug,
  normalizePosterTitle,
} from '../../server/services/webCatalogService.js';

describe('⚔️ DESAFÍO ADVERSARIAL M1: Integridad Contable, Mapeo Semántico y Deduplicación Bicapa', () => {

  // ==========================================================================
  // BLOQUE 1: Desafío Empírico de los 6 Casos Emblemáticos en parseStandIntent
  // ==========================================================================
  describe('1. Verificación de los 6 Casos Emblemáticos en parseStandIntent', () => {
    
    it('Caso 1: "1 de un verano sin ti portada en tarjeta"', () => {
      const query = '1 de un verano sin ti portada en tarjeta';
      const parsed = parseStandIntent(query);

      assert.strictEqual(parsed.isSaleIntent, true, 'Debe ser intención de venta');
      assert.strictEqual(parsed.paymentMethod, 'TARJETA', 'Método debe ser TARJETA');
      assert.strictEqual(parsed.items.length, 1, 'Debe extraer exactamente 1 ítem');

      const item = parsed.items[0];
      assert.strictEqual(item.quantity, 1, 'Cantidad debe ser 1');
      assert.strictEqual(item.sizeId, 'PORTADA_ALBUM', 'Tamaño debe ser PORTADA_ALBUM');
      assert.strictEqual(item.unitPrice, 55.0, 'Precio unitario debe ser Q55.00');
      assert.strictEqual(item.subtotal, 55.0, 'Subtotal debe ser 1 * 55.00 = Q55.00');
      assert.strictEqual(parsed.estimatedTotal, 55.0, 'Total debe ser matemáticamente exacto Q55.00');
      assert.ok(item.canonicalName.includes('Un Verano Sin Ti'), 'Debe resolver título canónico');
    });

    it('Caso 2: "2 de bad bunny un verano sin ti vinilo por transferencia"', () => {
      const query = '2 de bad bunny un verano sin ti vinilo por transferencia';
      const parsed = parseStandIntent(query);

      assert.strictEqual(parsed.isSaleIntent, true, 'Debe ser intención de venta');
      assert.strictEqual(parsed.paymentMethod, 'TRANSFERENCIA', 'Método debe ser TRANSFERENCIA');
      assert.strictEqual(parsed.items.length, 1, 'Debe extraer exactamente 1 ítem');

      const item = parsed.items[0];
      assert.strictEqual(item.quantity, 2, 'Cantidad debe ser 2');
      assert.strictEqual(item.sizeId, 'PORTADA_ALBUM', 'Tamaño vinilo debe ser PORTADA_ALBUM');
      assert.strictEqual(item.unitPrice, 55.0, 'Precio unitario debe ser Q55.00');
      assert.strictEqual(item.subtotal, 110.0, 'Subtotal debe ser 2 * 55.00 = Q110.00');
      assert.strictEqual(parsed.estimatedTotal, 110.0, 'Total debe ser matemáticamente exacto Q110.00');
      assert.ok(item.canonicalName.includes('Un Verano Sin Ti'), 'Debe resolver título canónico');
    });

    it('Caso 3: "3 del conejo malo portada en efectivo"', () => {
      const query = '3 del conejo malo portada en efectivo';
      const parsed = parseStandIntent(query);

      assert.strictEqual(parsed.isSaleIntent, true, 'Debe ser intención de venta');
      assert.strictEqual(parsed.paymentMethod, 'EFECTIVO', 'Método debe ser EFECTIVO');
      assert.strictEqual(parsed.items.length, 1, 'Debe extraer exactamente 1 ítem');

      const item = parsed.items[0];
      assert.strictEqual(item.quantity, 3, 'Cantidad debe ser 3');
      assert.strictEqual(item.sizeId, 'PORTADA_ALBUM', 'Tamaño portada debe ser PORTADA_ALBUM');
      assert.strictEqual(item.unitPrice, 55.0, 'Precio unitario debe ser Q55.00');
      assert.strictEqual(item.subtotal, 165.0, 'Subtotal debe ser 3 * 55.00 = Q165.00');
      assert.strictEqual(parsed.estimatedTotal, 165.0, 'Total debe ser matemáticamente exacto Q165.00');
      assert.ok(item.canonicalName.includes('Un Verano Sin Ti'), 'Debe resolver el conejo malo hacia Bad Bunny');
    });

    it('Caso 4: "1 spider man vintage comic mediano en visa"', () => {
      const query = '1 spider man vintage comic mediano en visa';
      const parsed = parseStandIntent(query);

      assert.strictEqual(parsed.isSaleIntent, true, 'Debe ser intención de venta');
      assert.strictEqual(parsed.paymentMethod, 'TARJETA', 'Método por visa debe ser TARJETA');
      assert.strictEqual(parsed.items.length, 1, 'Debe extraer exactamente 1 ítem');

      const item = parsed.items[0];
      assert.strictEqual(item.quantity, 1, 'Cantidad debe ser 1');
      assert.strictEqual(item.sizeId, 'MEDIANO', 'Tamaño debe ser MEDIANO');
      assert.strictEqual(item.unitPrice, 65.0, 'Precio unitario mediano debe ser Q65.00');
      assert.strictEqual(item.subtotal, 65.0, 'Subtotal debe ser 1 * 65.00 = Q65.00');
      assert.strictEqual(parsed.estimatedTotal, 65.0, 'Total debe ser matemáticamente exacto Q65.00');
    });

    it('Caso 5: "2 de pablo escobar sonrisa en banrural transferencia"', () => {
      const query = '2 de pablo escobar sonrisa en banrural transferencia';
      const parsed = parseStandIntent(query);

      assert.strictEqual(parsed.isSaleIntent, true, 'Debe ser intención de venta');
      assert.strictEqual(parsed.paymentMethod, 'TRANSFERENCIA', 'Método por banrural transferencia debe ser TRANSFERENCIA');
      assert.strictEqual(parsed.items.length, 1, 'Debe extraer exactamente 1 ítem');

      const item = parsed.items[0];
      assert.strictEqual(item.quantity, 2, 'Cantidad debe ser 2');
      assert.strictEqual(item.sizeId, 'MEDIANO', 'Tamaño por defecto debe ser MEDIANO');
      assert.strictEqual(item.unitPrice, 65.0, 'Precio unitario mediano debe ser Q65.00');
      assert.strictEqual(item.subtotal, 130.0, 'Subtotal debe ser 2 * 65.00 = Q130.00');
      assert.strictEqual(parsed.estimatedTotal, 130.0, 'Total debe ser matemáticamente exacto Q130.00');
      assert.ok(item.canonicalName.includes('Pablo Escobar'), 'Debe resolver título canónico de Pablo Escobar');
    });

    it('Caso 6: "1 de checo perez f1 portada en credomatic"', () => {
      const query = '1 de checo perez f1 portada en credomatic';
      const parsed = parseStandIntent(query);

      assert.strictEqual(parsed.isSaleIntent, true, 'Debe ser intención de venta');
      assert.strictEqual(parsed.paymentMethod, 'TARJETA', 'Método por credomatic debe ser TARJETA');
      assert.strictEqual(parsed.items.length, 1, 'Debe extraer exactamente 1 ítem');

      const item = parsed.items[0];
      assert.strictEqual(item.quantity, 1, 'Cantidad debe ser 1');
      assert.strictEqual(item.sizeId, 'PORTADA_ALBUM', 'Tamaño portada debe ser PORTADA_ALBUM');
      assert.strictEqual(item.unitPrice, 55.0, 'Precio unitario debe ser Q55.00');
      assert.strictEqual(item.subtotal, 55.0, 'Subtotal debe ser 1 * 55.00 = Q55.00');
      assert.strictEqual(parsed.estimatedTotal, 55.0, 'Total debe ser matemáticamente exacto Q55.00');
      assert.ok(item.canonicalName.includes('Checo Pérez') || item.canonicalName.includes('F1'), 'Debe resolver F1 Checo Pérez');
    });
  });

  // ==========================================================================
  // BLOQUE 2: Desafío de Integridad Contable en constructDraftPayload
  // ==========================================================================
  describe('2. Integridad Contable Adversarial en constructDraftPayload', () => {

    it('Caso 1 en borrador: Forzado de Q55.00 y TARJETA frente a alucinaciones del LLM', async () => {
      // El LLM devuelve unitPrice: 65 (incorrecto) y paymentMethod: "EFECTIVO" (incorrecto)
      const draft = await constructDraftPayload('tenant-audit', {
        items: [{ productName: 'Un Verano Sin Ti', size: 'portada', quantity: 1, unitPrice: 65 }],
        paymentMethod: 'EFECTIVO',
      }, '1 de un verano sin ti portada en tarjeta');

      assert.strictEqual(draft.paymentMethod, 'TARJETA', 'Debe sobrescribir a TARJETA por userMessage');
      assert.strictEqual(draft.items[0].sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(draft.items[0].unitPrice, 55.0, 'Debe corregir unitPrice a 55.00');
      assert.strictEqual(draft.items[0].subtotal, 55.0);
      assert.strictEqual(draft.total, 55.0, 'Total debe ser 55.00');
    });

    it('Caso 2 en borrador: 2 vinilos por transferencia (Total Q110.00)', async () => {
      const draft = await constructDraftPayload('tenant-audit', {
        items: [{ productName: 'Bad Bunny Un Verano Sin Ti', size: 'vinilo', quantity: 2, unitPrice: null }],
        paymentMethod: null,
      }, '2 de bad bunny un verano sin ti vinilo por transferencia');

      assert.strictEqual(draft.paymentMethod, 'TRANSFERENCIA');
      assert.strictEqual(draft.items[0].sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(draft.items[0].quantity, 2);
      assert.strictEqual(draft.items[0].unitPrice, 55.0);
      assert.strictEqual(draft.items[0].subtotal, 110.0);
      assert.strictEqual(draft.total, 110.0);
    });

    it('Caso 3 en borrador: 3 portadas del conejo malo en efectivo (Total Q165.00)', async () => {
      const draft = await constructDraftPayload('tenant-audit', {
        items: [{ productName: 'El Conejo Malo', size: 'portada', quantity: 3, unitPrice: 65.0 }],
        paymentMethod: 'EFECTIVO',
      }, '3 del conejo malo portada en efectivo');

      assert.strictEqual(draft.paymentMethod, 'EFECTIVO');
      assert.strictEqual(draft.items[0].sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(draft.items[0].quantity, 3);
      assert.strictEqual(draft.items[0].unitPrice, 55.0);
      assert.strictEqual(draft.items[0].subtotal, 165.0);
      assert.strictEqual(draft.total, 165.0);
    });

    it('Caso 4 en borrador: 1 spider man vintage comic mediano en visa (Total Q65.00)', async () => {
      const draft = await constructDraftPayload('tenant-audit', {
        items: [{ productName: 'Spider-Man Vintage Comic', size: 'mediano', quantity: 1, unitPrice: null }],
        paymentMethod: 'EFECTIVO',
      }, '1 spider man vintage comic mediano en visa');

      assert.strictEqual(draft.paymentMethod, 'TARJETA', 'Visa debe inferir TARJETA');
      assert.strictEqual(draft.items[0].sizeId, 'MEDIANO');
      assert.strictEqual(draft.items[0].quantity, 1);
      assert.strictEqual(draft.items[0].unitPrice, 65.0);
      assert.strictEqual(draft.items[0].subtotal, 65.0);
      assert.strictEqual(draft.total, 65.0);
    });

    it('Caso 5 en borrador: 2 pablo escobar sonrisa en banrural transferencia (Total Q130.00)', async () => {
      const draft = await constructDraftPayload('tenant-audit', {
        items: [{ productName: 'Pablo Escobar Sonrisa', size: 'mediano', quantity: 2, unitPrice: 65.0 }],
        paymentMethod: 'EFECTIVO',
      }, '2 de pablo escobar sonrisa en banrural transferencia');

      assert.strictEqual(draft.paymentMethod, 'TRANSFERENCIA', 'Banrural transferencia debe inferir TRANSFERENCIA');
      assert.strictEqual(draft.items[0].sizeId, 'MEDIANO');
      assert.strictEqual(draft.items[0].quantity, 2);
      assert.strictEqual(draft.items[0].unitPrice, 65.0);
      assert.strictEqual(draft.items[0].subtotal, 130.0);
      assert.strictEqual(draft.total, 130.0);
    });

    it('Caso 6 en borrador: 1 checo perez f1 portada en credomatic (Total Q55.00)', async () => {
      const draft = await constructDraftPayload('tenant-audit', {
        items: [{ productName: 'Checo Perez F1', size: 'portada', quantity: 1, unitPrice: 65.0 }],
        paymentMethod: 'EFECTIVO',
      }, '1 de checo perez f1 portada en credomatic');

      assert.strictEqual(draft.paymentMethod, 'TARJETA', 'Credomatic debe inferir TARJETA');
      assert.strictEqual(draft.items[0].sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(draft.items[0].quantity, 1);
      assert.strictEqual(draft.items[0].unitPrice, 55.0);
      assert.strictEqual(draft.items[0].subtotal, 55.0);
      assert.strictEqual(draft.total, 55.0);
    });
  });

  // ==========================================================================
  // BLOQUE 3: Prueba de Estrés de Normalización de Tamaños y Medidas
  // ==========================================================================
  describe('3. Normalización Exhaustiva de Tamaños a PORTADA_ALBUM y Otros', () => {
    it('Resuelve variantes de portada de álbum invariablemente a PORTADA_ALBUM', () => {
      const portadaVariants = [
        'portada',
        'PORTADA',
        'portada de album',
        'portada de álbum',
        'portada album',
        'vinilo',
        'VINILO',
        'cuadrado',
        'cuadrada',
        'disco',
        'DISCO',
        '30x30',
        '30 x 30 cm',
        '12x12',
        '12 x 12 pulgadas',
        '12x12 in',
      ];
      for (const variant of portadaVariants) {
        assert.strictEqual(
          normalizeCatalogSizeId(variant),
          'PORTADA_ALBUM',
          `Fallo al normalizar variante: "${variant}"`
        );
      }
    });

    it('Resuelve medidas estándar sin colisión', () => {
      assert.strictEqual(normalizeCatalogSizeId('18x24'), 'GRANDE');
      assert.strictEqual(normalizeCatalogSizeId('18 x 24 pulgadas'), 'GRANDE');
      assert.strictEqual(normalizeCatalogSizeId('24x36'), 'GIGANTE');
      assert.strictEqual(normalizeCatalogSizeId('12x18'), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId('21x27'), 'PEQUENO');
      assert.strictEqual(normalizeCatalogSizeId('14x21'), 'MINI');
    });
  });

  // ==========================================================================
  // BLOQUE 4: Prueba de Estrés de Deduplicación Bicapa (deduplicatePosters)
  // ==========================================================================
  describe('4. Deduplicación Bicapa en Catálogo Web (deduplicatePosters)', () => {
    it('Elimina duplicados de ID, URL de imagen y título semántico con lote de 20 obras', () => {
      const rawPosters = [
        // Obras legítimas 1 a 12
        { id: 'p1', name: 'Bad Bunny - Un Verano Sin Ti', imageUrl: 'https://cdn/bb-uvst.jpg' },
        { id: 'p2', name: 'Taylor Swift - 1989', imageUrl: 'https://cdn/ts-1989.jpg' },
        { id: 'p3', name: 'Spider-Man Vintage Comic', imageUrl: 'https://cdn/spiderman.jpg' },
        { id: 'p4', name: 'Pablo Escobar (Sonrisa / Mugshot)', imageUrl: 'https://cdn/pablo-escobar.jpg' },
        { id: 'p5', name: 'F1 - Red Bull Racing Checo Perez', imageUrl: 'https://cdn/checo-f1.jpg' },
        { id: 'p6', name: 'The Beatles - Abbey Road', imageUrl: 'https://cdn/beatles-abbey.jpg' },
        { id: 'p7', name: 'Pink Floyd - Dark Side of the Moon', imageUrl: 'https://cdn/pink-floyd-prism.jpg' },
        { id: 'p8', name: 'Batman - The Dark Knight', imageUrl: 'https://cdn/batman-dk.jpg' },
        { id: 'p9', name: 'Chainsaw Man - Denji', imageUrl: 'https://cdn/csm-denji.jpg' },
        { id: 'p10', name: 'Dragon Ball Goku Ultra Instinct', imageUrl: 'https://cdn/goku-ui.jpg' },
        { id: 'p11', name: 'Star Wars Darth Vader', imageUrl: 'https://cdn/vader.jpg' },
        { id: 'p12', name: 'Pulp Fiction - Mia Wallace', imageUrl: 'https://cdn/pulp-fiction.jpg' },

        // Duplicados adversariales:
        // Clones por ID
        { id: 'p1', name: 'Bad Bunny Un Verano Clon', imageUrl: 'https://cdn/other1.jpg' },
        { id: 'p3', name: 'Spider-Man Clon', imageUrl: 'https://cdn/other2.jpg' },

        // Clones por Slug de Imagen (con dimensiones y params)
        { id: 'p13', name: 'Benito Verano', imageUrl: 'https://cdn/bb-uvst-500x750.webp?token=xyz' },
        { id: 'p14', name: 'Peter Parker Comic', imageUrl: 'https://cdn/spiderman-preview.png' },

        // Clones por Título Semántico
        { id: 'p15', name: 'taylor swift - 1989!', imageUrl: 'https://cdn/diff-img.jpg' },
        { id: 'p16', name: 'Pablo Escobar: Sonrisa / Mugshot', imageUrl: 'https://cdn/diff-pablo.jpg' },
      ];

      const deduplicated = deduplicatePosters(rawPosters);

      // Debe haber exactamente 12 obras únicas
      assert.strictEqual(deduplicated.length, 12, 'Deben quedar exactamente las 12 obras únicas');

      // Verificar que los clones fueron eliminados
      const ids = deduplicated.map(p => p.id);
      assert.ok(ids.includes('p1'));
      assert.ok(!ids.includes('p13'), 'p13 debió ser eliminado por imagen repetida con p1');
      assert.ok(!ids.includes('p14'), 'p14 debió ser eliminado por imagen repetida con p3');
      assert.ok(!ids.includes('p15'), 'p15 debió ser eliminado por título semántico repetido con p2');
      assert.ok(!ids.includes('p16'), 'p16 debió ser eliminado por título semántico repetido con p4');
    });

    it('Preserva obras diferentes del mismo artista', () => {
      const badBunnyAlbums = [
        { id: 'bb-1', name: 'Bad Bunny - Un Verano Sin Ti', imageUrl: 'https://cdn/uvst.jpg' },
        { id: 'bb-2', name: 'Bad Bunny - YHLQMDLG', imageUrl: 'https://cdn/yhlqmdlg.jpg' },
        { id: 'bb-3', name: 'Bad Bunny - Nadie Sabe Lo Que Va a Pasar Mañana', imageUrl: 'https://cdn/nadie-sabe.jpg' },
      ];
      const result = deduplicatePosters(badBunnyAlbums);
      assert.strictEqual(result.length, 3, 'No debe filtrar obras distintas del mismo artista');
    });
  });

  // ==========================================================================
  // BLOQUE 5: Verificación de Límites a 12 Obras en Código Fuente
  // ==========================================================================
  describe('5. Auditoría de Límites de Búsqueda a 12 en Backend', () => {
    it('Verifica que aiController.js y aiMultimodalService.js usen limit: 12 y erradiquen limit: 3/4', () => {
      const aiControllerFile = path.join(ROOT, 'server/controllers/aiController.js');
      const aiMultimodalFile = path.join(ROOT, 'server/services/aiMultimodalService.js');

      const controllerContent = fs.readFileSync(aiControllerFile, 'utf-8');
      const multimodalContent = fs.readFileSync(aiMultimodalFile, 'utf-8');

      // Comprobar presencia de limit: 12
      assert.ok(controllerContent.includes('limit: 12'), 'aiController.js debe tener limit: 12');
      assert.ok(multimodalContent.includes('limit: 12'), 'aiMultimodalService.js debe tener limit: 12');

      // Comprobar ausencia de limit: 3 o limit: 4 en llamadas a searchWebPosters
      const searchCallRegex = /searchWebPosters\(\s*\{[^}]*limit:\s*[34]\b/g;
      assert.ok(!searchCallRegex.test(controllerContent), 'aiController.js no debe tener searchWebPosters con limit: 3 o 4');
      assert.ok(!searchCallRegex.test(multimodalContent), 'aiMultimodalService.js no debe tener searchWebPosters con limit: 3 o 4');
    });
  });
});
