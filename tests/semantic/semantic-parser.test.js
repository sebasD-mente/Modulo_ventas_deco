import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPaymentMethod,
  resolveEntityAlias,
  normalizeArtworkQuery,
  parseStandIntent,
  normalizeSemanticText,
  STAND_ENTITY_ALIASES,
} from '../../server/services/semanticParserService.js';
import {
  normalizeCatalogSizeId,
  constructDraftPayload,
} from '../../server/services/aiMultimodalService.js';

describe('🧠 Suite de Parser Semántico, Métodos de Pago y Diccionario Cultural (STAND {IA})', () => {
  describe('1. Extracción Determinística de Métodos de Pago (extractPaymentMethod)', () => {
    it('Detecta TARJETA con preposiciones y variantes comunes en stand', () => {
      assert.strictEqual(extractPaymentMethod('1 portada en tarjeta'), 'TARJETA');
      assert.strictEqual(extractPaymentMethod('pagó con pos'), 'TARJETA');
      assert.strictEqual(extractPaymentMethod('pasó tarjeta de débito visa'), 'TARJETA');
      assert.strictEqual(extractPaymentMethod('cliente paga con credomatic'), 'TARJETA');
      assert.strictEqual(extractPaymentMethod('cobrado por terminal'), 'TARJETA');
      assert.strictEqual(extractPaymentMethod('pago con link de pago neonet'), 'TARJETA');
      assert.strictEqual(extractPaymentMethod('desliza la tarjeta'), 'TARJETA');
    });

    it('Detecta TRANSFERENCIA con preposiciones y canales bancarios', () => {
      assert.strictEqual(extractPaymentMethod('vendí 2 por transferencia'), 'TRANSFERENCIA');
      assert.strictEqual(extractPaymentMethod('pagó con transfe de BI'), 'TRANSFERENCIA');
      assert.strictEqual(extractPaymentMethod('depósito banrural confirmado'), 'TRANSFERENCIA');
      assert.strictEqual(extractPaymentMethod('mostró comprobante de banca en linea'), 'TRANSFERENCIA');
      assert.strictEqual(extractPaymentMethod('pago mediante ach'), 'TRANSFERENCIA');
    });

    it('Detecta EFECTIVO y previene que la palabra "quetzales" se confunda con efectivo', () => {
      assert.strictEqual(extractPaymentMethod('en efectivo por favor'), 'EFECTIVO');
      assert.strictEqual(extractPaymentMethod('me dio un billete de 100'), 'EFECTIVO');
      assert.strictEqual(extractPaymentMethod('pago en mano'), 'EFECTIVO');
      assert.strictEqual(extractPaymentMethod('al contado'), 'EFECTIVO');
      assert.strictEqual(extractPaymentMethod('con cashito'), 'EFECTIVO');

      // Desambiguación crítica: "quetzales" indica moneda, NO efectivo
      assert.strictEqual(extractPaymentMethod('cuesta 65 quetzales en tarjeta'), 'TARJETA');
      assert.strictEqual(extractPaymentMethod('1 póster a 55 quetzales por transferencia'), 'TRANSFERENCIA');
      assert.strictEqual(extractPaymentMethod('son 55 quetzales'), null);
      assert.strictEqual(extractPaymentMethod('precio 125 quetzales'), null);
    });

    it('Maneja entradas vacías, nulas o sin método de pago', () => {
      assert.strictEqual(extractPaymentMethod(''), null);
      assert.strictEqual(extractPaymentMethod(null), null);
      assert.strictEqual(extractPaymentMethod(undefined), null);
      assert.strictEqual(extractPaymentMethod('solo quiero ver pósters de anime'), null);
    });
  });

  describe('2. Diccionario Cultural de Entidades (STAND_ENTITY_ALIASES)', () => {
    it('Resuelve apodos populares de música hacia títulos canónicos', () => {
      assert.strictEqual(resolveEntityAlias('un verano sin ti').canonicalTitle, 'Bad Bunny - Un Verano Sin Ti');
      assert.strictEqual(resolveEntityAlias('el conejo malo').canonicalTitle, 'Bad Bunny - Un Verano Sin Ti');
      assert.strictEqual(resolveEntityAlias('benito').canonicalTitle, 'Bad Bunny - Un Verano Sin Ti');
      assert.strictEqual(resolveEntityAlias('la taylor').canonicalTitle, 'Taylor Swift - The Eras Tour / 1989');
      assert.strictEqual(resolveEntityAlias('abbey road').canonicalTitle, 'The Beatles - Abbey Road');
      assert.strictEqual(resolveEntityAlias('el prisma de pink floyd').canonicalTitle, 'Pink Floyd - The Dark Side of the Moon');
      assert.strictEqual(resolveEntityAlias('el bebe en la piscina').canonicalTitle, 'Nirvana - Nevermind');
    });

    it('Resuelve apodos de superhéroes y anime', () => {
      assert.strictEqual(resolveEntityAlias('spiderman').canonicalTitle, 'Spider-Man Vintage Comic');
      assert.strictEqual(resolveEntityAlias('el hombre araña').canonicalTitle, 'Spider-Man Vintage Comic');
      assert.strictEqual(resolveEntityAlias('el caballero de la noche').canonicalTitle, 'Batman - The Dark Knight');
      assert.strictEqual(resolveEntityAlias('el guason').canonicalTitle, 'Joker - Heath Ledger / Phoenix');
      assert.strictEqual(resolveEntityAlias('el pibe motosierra').canonicalTitle, 'Chainsaw Man - Denji & Pochita');
      assert.strictEqual(resolveEntityAlias('ultra instinto').canonicalTitle, 'Dragon Ball - Goku Ultra Instinct');
      assert.strictEqual(resolveEntityAlias('rengoku').canonicalTitle, 'Demon Slayer - Kimetsu no Yaiba');
    });

    it('Resuelve motorsport, autos y cine de culto', () => {
      assert.strictEqual(resolveEntityAlias('checo perez').canonicalTitle, 'F1 - Red Bull Racing (Checo Pérez & Verstappen)');
      assert.strictEqual(resolveEntityAlias('el de checo').canonicalTitle, 'F1 - Red Bull Racing (Checo Pérez & Verstappen)');
      assert.strictEqual(resolveEntityAlias('el patron').canonicalTitle, 'Pablo Escobar (Sonrisa / Mugshot)');
      assert.strictEqual(resolveEntityAlias('la sonrisa de pablo').canonicalTitle, 'Pablo Escobar (Sonrisa / Mugshot)');
      assert.strictEqual(resolveEntityAlias('baby yoda').canonicalTitle, 'Star Wars - Darth Vader & Grogu');
      assert.strictEqual(resolveEntityAlias('tiempos violentos').canonicalTitle, 'Pulp Fiction - Tiempos Violentos');
      assert.strictEqual(resolveEntityAlias('heisenberg').canonicalTitle, 'Breaking Bad - Walter White Heisenberg');
    });

    it('Retorna matched: false ante términos desconocidos', () => {
      const res = resolveEntityAlias('algo completamente desconocido xyz 123');
      assert.strictEqual(res.matched, false);
    });
  });

  describe('3. Normalización de Consultas de Catálogo (normalizeArtworkQuery)', () => {
    it('Traduce alias culturales a consultas canónicas de búsqueda', () => {
      assert.strictEqual(normalizeArtworkQuery('el conejo malo'), 'Un Verano Sin Ti Bad Bunny');
      assert.strictEqual(normalizeArtworkQuery('el pibe motosierra'), 'Chainsaw Man Denji Pochita');
      assert.strictEqual(normalizeArtworkQuery('el de checo'), 'Formula 1 Red Bull Checo Perez Verstappen');
    });

    it('Limpia palabras de relleno de mostrador cuando no es un alias exacto', () => {
      const res = normalizeArtworkQuery('el póster de Coldplay');
      assert.ok(!res.includes('el póster de'));
      assert.ok(res.includes('Coldplay'));
    });
  });

  describe('4. Parsing Semántico de Intenciones de Venta (parseStandIntent)', () => {
    it('Parsea la orden emblemática "1 de un verano sin ti portada en tarjeta"', () => {
      const res = parseStandIntent('1 de un verano sin ti portada en tarjeta');
      assert.strictEqual(res.isSaleIntent, true);
      assert.strictEqual(res.paymentMethod, 'TARJETA');
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].canonicalName, 'Bad Bunny - Un Verano Sin Ti');
      assert.strictEqual(res.items[0].sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(res.items[0].quantity, 1);
      assert.strictEqual(res.items[0].unitPrice, 55.0);
      assert.strictEqual(res.estimatedTotal, 55.0);
    });

    it('Parsea órdenes con múltiples artículos y métodos mixtos', () => {
      const res = parseStandIntent('2 spiderman mediano en efectivo');
      assert.strictEqual(res.paymentMethod, 'EFECTIVO');
      assert.strictEqual(res.items[0].quantity, 2);
      assert.strictEqual(res.items[0].sizeId, 'MEDIANO');
      assert.strictEqual(res.items[0].unitPrice, 65.0);
      assert.strictEqual(res.estimatedTotal, 130.0);
    });

    it('Manejo seguro de entradas vacías o inválidas en parseStandIntent', () => {
      const res = parseStandIntent(null);
      assert.strictEqual(res.isSaleIntent, false);
      assert.strictEqual(res.items.length, 0);
      assert.strictEqual(res.estimatedTotal, 0);
    });
  });

  describe('5. Normalización de Tamaños canónicos de STAND {IA}', () => {
    it('Mapea todas las variantes coloquiales de Portada a PORTADA_ALBUM', () => {
      const cases = ['portada', 'portada de album', 'portada de álbum', 'vinilo', 'cuadrado', 'cuadrada', 'disco', '30x30', '12x12'];
      for (const c of cases) {
        assert.strictEqual(normalizeCatalogSizeId(c), 'PORTADA_ALBUM', `Falla en normalización de: ${c}`);
      }
    });

    it('Mantiene la integridad de los otros tamaños estándar', () => {
      assert.strictEqual(normalizeCatalogSizeId('mini'), 'MINI');
      assert.strictEqual(normalizeCatalogSizeId('pequeño'), 'PEQUENO');
      assert.strictEqual(normalizeCatalogSizeId('mediano'), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId('grande'), 'GRANDE');
      assert.strictEqual(normalizeCatalogSizeId('gigante'), 'GIGANTE');
      assert.strictEqual(normalizeCatalogSizeId('18x24'), 'GRANDE');
      assert.strictEqual(normalizeCatalogSizeId('24x36'), 'GIGANTE');
    });
  });

  describe('6. Integridad Contable en constructDraftPayload (STAND {IA})', () => {
    it('Forza PORTADA_ALBUM a Q55.00 e infiere TARJETA determinísticamente', async () => {
      const draft = await constructDraftPayload('tenant-test', {
        items: [{ productName: 'Un Verano Sin Ti', size: 'portada', quantity: 1, unitPrice: 65 }]
      }, '1 de un verano sin ti portada en tarjeta');

      assert.strictEqual(draft.items.length, 1);
      assert.strictEqual(draft.items[0].sizeId, 'PORTADA_ALBUM');
      assert.strictEqual(draft.items[0].unitPrice, 55.0);
      assert.strictEqual(draft.items[0].subtotal, 55.0);
      assert.strictEqual(draft.total, 55.0);
      assert.strictEqual(draft.paymentMethod, 'TARJETA');
    });
  });
});
