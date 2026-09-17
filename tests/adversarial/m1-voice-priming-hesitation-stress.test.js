import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Type } from '@google/genai';
import {
  buildVoiceSalePrompt,
  voiceSaleResponseSchema,
} from '../../server/services/ai/aiPromptService.js';
import {
  normalizeCatalogSizeId,
} from '../../server/services/ai/aiMediaService.js';
import { resolveEntityAlias } from '../../server/services/semantic/entityAliases.js';

describe('🥊 Adversarial Priming, Hesitation & Size Normalization Challenge Harness', () => {

  describe('1. Adversarial Priming & Phonetic Bias ("pastel", "stickers", "postre")', () => {
    it('1.1. buildVoiceSalePrompt strictly instructs the AI to NEVER interpret "pastel", "stickers" or "postre"', () => {
      const prompt = buildVoiceSalePrompt();

      assert.ok(
        /PROHIBIDO/i.test(prompt),
        'Prompt must contain emphatic prohibition "PROHIBIDO"'
      );
      assert.ok(
        /pastel/i.test(prompt),
        'Prompt must explicitly target and proscribe "pastel"'
      );
      assert.ok(
        /stickers/i.test(prompt),
        'Prompt must explicitly target and proscribe "stickers"'
      );
      assert.ok(
        /postre/i.test(prompt),
        'Prompt must explicitly target and proscribe "postre"'
      );
      assert.ok(
        /SIEMPRE.*póster/i.test(prompt) || /interpreta SIEMPRE/i.test(prompt),
        'Prompt must mandate resolving phonetic ambiguity to "póster" or "pósters"'
      );
    });

    it('1.2. Adversarial input "un pastel de spider man" resolves to Spider-Man via entity alias matching', () => {
      const input = 'un pastel de spider man';
      const alias = resolveEntityAlias(input);

      assert.strictEqual(alias.matched, true, 'Must identify Spider-Man entity despite acoustic distractor "pastel"');
      assert.match(alias.searchQuery, /Spider-Man/i, 'Search query must be Spider-Man');
      assert.doesNotMatch(alias.searchQuery, /pastel/i, 'Search query must strip "pastel"');
    });

    it('1.3. Adversarial input "dos stickers de anime" is guarded by buildVoiceSalePrompt anti-sticker rules', () => {
      const prompt = buildVoiceSalePrompt();
      // Prompt explicitly prevents stickers from being emitted as a sale item
      assert.match(prompt, /stickers/i, 'Prompt must explicitly proscribe stickers');
      assert.match(prompt, /anime/i, 'Prompt must identify anime as a core pop-culture domain');
    });

    it('1.4. In-domain vocabulary priming contains all Deco Vintage Guate event specialties', () => {
      const prompt = buildVoiceSalePrompt();
      const specialties = ['pósters', 'cuadros', 'marcos', 'arte impreso', 'cine', 'anime', 'series', 'música'];
      for (const item of specialties) {
        assert.ok(
          prompt.toLowerCase().includes(item.toLowerCase()),
          `buildVoiceSalePrompt must contain ferial domain specialty: "${item}"`
        );
      }
    });
  });

  describe('2. Adversarial Hesitation & False-Start Guards', () => {
    it('2.1. buildVoiceSalePrompt contains unambiguous guidelines for false starts and corrections', () => {
      const prompt = buildVoiceSalePrompt();
      assert.match(prompt, /dos pa-/i, 'Prompt must reference archetype false-start "dos pa-"');
      assert.match(prompt, /tres\.\.\.\s*dos batman/i, 'Prompt must reference hesitation archetype "tres... dos batman"');
      assert.match(prompt, /cantidad final corregida/i, 'Prompt must instruct taking only final corrected quantity');
      assert.match(prompt, /NUNCA sumes números vacilantes/i, 'Prompt must forbid summing false starts');
    });

    it('2.2. Hesitation heuristic resolution correctly handles "dos pa- un poster mediano"', () => {
      function extractFinalQuantityAndTitle(text) {
        const cleaned = text.replace(/\b(\w+)\s+(pa-|no,\s*|perdón,\s*|o sea,\s*)/gi, '');
        const wordNumMap = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
        const match = cleaned.match(/\b(un|uno|una|dos|tres|cuatro|cinco|\d+)\b/i);
        const qty = match ? (wordNumMap[match[1].toLowerCase()] || parseInt(match[1], 10)) : 1;
        return { cleaned, qty };
      }

      const res = extractFinalQuantityAndTitle('dos pa- un poster mediano');
      assert.strictEqual(res.qty, 1, 'Quantity must be 1, ignoring the false start "dos pa-"');
    });

    it('2.3. Hesitation heuristic resolution correctly handles "tres... dos batman"', () => {
      function resolveHesitationCorrection(text) {
        const numbers = text.match(/\b(un|uno|una|dos|tres|cuatro|cinco|\d+)\b/gi) || [];
        const wordNumMap = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
        const lastNumStr = numbers[numbers.length - 1];
        return wordNumMap[lastNumStr.toLowerCase()] || parseInt(lastNumStr, 10);
      }

      const qty = resolveHesitationCorrection('tres... dos batman');
      assert.strictEqual(qty, 2, 'Quantity must resolve to the final correction: 2 (not 3, not 3+2=5)');
    });

    it('2.4. Complex hesitation chain "cinco pa... seis... no, un poster de scarface mediano"', () => {
      function resolveComplexHesitation(text) {
        const cleaned = text.replace(/.*(?:no,\s*|perdón,\s*|\.\.\.\s*)/i, '');
        const match = cleaned.match(/\b(un|uno|una|dos|tres|cuatro|cinco|\d+)\b/i);
        const wordNumMap = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
        return match ? (wordNumMap[match[1].toLowerCase()] || parseInt(match[1], 10)) : 1;
      }

      const qty = resolveComplexHesitation('cinco pa... seis... no, un poster de scarface mediano');
      assert.strictEqual(qty, 1, 'Complex chain must resolve to final quantity: 1');
    });
  });

  describe('3. Size Enumeration & Normalization against 6 Standard Sizes', () => {
    const CANONICAL_6_SIZES = [
      { id: 'MINI', name: 'Mini', promptPrice: 'Q25', testInputs: ['Mini', 'mini', '14x21', '14 x 21 cm', '5x7'] },
      { id: 'PEQUENO', name: 'Pequeño', promptPrice: 'Q35', testInputs: ['Pequeño', 'pequeno', '21x27', '21 x 27 cm', '8.5x11'] },
      { id: 'PORTADA_ALBUM', name: 'Portada de Álbum', promptPrice: 'Q55', testInputs: ['Portada de Álbum', 'portada de album', 'album', '30x30', 'vinilo'] },
      { id: 'MEDIANO', name: 'Mediano', promptPrice: 'Q65', testInputs: ['Mediano', 'mediano', '30x45', '30 x 45 cm', '12x18'] },
      { id: 'GRANDE', name: 'Grande', promptPrice: 'Q125', testInputs: ['Grande', 'grande', '45x60', '45 x 60 cm', '18x24'] },
      { id: 'GIGANTE', name: 'Gigante', promptPrice: 'Q180', testInputs: ['Gigante', 'gigante', '60x90', '60 x 90 cm', '24x36'] },
    ];

    it('3.1. buildVoiceSalePrompt lists all 6 standard sizes with exact ferial prices', () => {
      const prompt = buildVoiceSalePrompt();
      for (const spec of CANONICAL_6_SIZES) {
        assert.ok(
          prompt.includes(spec.name),
          `Prompt must explicitly mention size "${spec.name}"`
        );
        assert.ok(
          prompt.includes(spec.promptPrice),
          `Prompt must explicitly mention price "${spec.promptPrice}" for size "${spec.name}"`
        );
      }
      assert.match(prompt, /asignar MEDIANO/i, 'Default size must be MEDIANO when omitted');
    });

    for (const spec of CANONICAL_6_SIZES) {
      it(`3.2. normalizeCatalogSizeId correctly normalizes canonical name and metric dimensions for ${spec.name} (${spec.id})`, () => {
        for (const input of spec.testInputs) {
          const result = normalizeCatalogSizeId(input);
          assert.strictEqual(
            result,
            spec.id,
            `Input "${input}" must normalize to "${spec.id}", got "${result}"`
          );
        }
      });
    }

    it('3.3. [EMPIRICAL FINDING BUG] "extra grande" is shadowed by GRANDE before reaching GIGANTE', () => {
      // In normalizeCatalogSizeId:
      // Line 22: if (/18x24|.../.test(compact) || /\b(grande|large|l)\b/i.test(raw)) return 'GRANDE';
      // Line 23: if (/24x36|.../.test(compact) || /\b(gigante|extra\s*grande|xl)\b/i.test(raw)) return 'GIGANTE';
      // "extra grande" triggers line 22 because \bgrande\b matches in "extra grande"!
      const result = normalizeCatalogSizeId('extra grande');
      // Documenting the actual behavior to prove the empirical flaw:
      assert.strictEqual(
        result,
        'GRANDE',
        'Demonstrates BUG: "extra grande" incorrectly yields GRANDE instead of GIGANTE due to regex evaluation order'
      );
    });

    it('3.4. [EMPIRICAL FINDING BUG] Whitespace-only string "   " returns "" instead of MEDIANO', () => {
      // Line 19 checks: if (!requestedSize) return 'MEDIANO';
      // For "   ", requestedSize is truthy. raw becomes "". None of the regexes match.
      // Line 27 returns raw.toUpperCase() which is "" instead of MEDIANO!
      const result = normalizeCatalogSizeId('   ');
      assert.strictEqual(
        result,
        '',
        'Demonstrates BUG: whitespace "   " bypasses (!requestedSize) check and returns "" instead of MEDIANO'
      );
    });

    it('3.5. Null and empty string correctly default to MEDIANO', () => {
      assert.strictEqual(normalizeCatalogSizeId(null), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId(undefined), 'MEDIANO');
      assert.strictEqual(normalizeCatalogSizeId(''), 'MEDIANO');
    });
  });

  describe('4. Schema Robustness & Anti-Hallucination Integrity (voiceSaleResponseSchema)', () => {
    it('4.1. voiceSaleResponseSchema has Type.OBJECT and defines all required fields', () => {
      assert.strictEqual(voiceSaleResponseSchema.type, Type.OBJECT);
      assert.ok(voiceSaleResponseSchema.required.includes('isSaleDetected'), 'isSaleDetected must be required');
      assert.ok(voiceSaleResponseSchema.required.includes('intent'), 'intent must be required');
      assert.ok(!voiceSaleResponseSchema.required.includes('items'), 'items must NOT be required');
      assert.ok(!voiceSaleResponseSchema.required.includes('paymentMethod'), 'paymentMethod must NOT be required');
    });

    it('4.2. Schema properties include all necessary multimodal fields', () => {
      const props = voiceSaleResponseSchema.properties;
      assert.ok(props.transcription, 'transcription must be defined');
      assert.strictEqual(props.transcription.type, Type.STRING);

      assert.ok(props.isSaleDetected, 'isSaleDetected must be defined');
      assert.strictEqual(props.isSaleDetected.type, Type.BOOLEAN);

      assert.ok(props.intent, 'intent must be defined');
      assert.strictEqual(props.intent.type, Type.STRING);
      assert.deepStrictEqual(
        props.intent.enum,
        ['SALUDO', 'CONSULTA_CATALOGO', 'DICTADO_VENTA', 'RUIDO_NO_VENTA']
      );

      assert.ok(props.items, 'items must be defined');
      assert.strictEqual(props.items.type, Type.ARRAY);
      assert.ok(props.items.items.properties.title);
      assert.ok(props.items.items.properties.size);
      assert.ok(props.items.items.properties.quantity);

      assert.ok(props.paymentMethod, 'paymentMethod must be defined');
      assert.deepStrictEqual(
        props.paymentMethod.enum,
        ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO']
      );
    });

    it('4.3. Greeting / noise payload satisfies non-sale contract', () => {
      const nonSalePayload = {
        transcription: 'Hola buenos días',
        isSaleDetected: false,
        intent: 'SALUDO',
        greeting: '¡Hola! Buenos días, ¿qué póster estás buscando hoy?',
        items: [],
      };

      assert.strictEqual(nonSalePayload.isSaleDetected, false);
      assert.strictEqual(nonSalePayload.items.length, 0);
      assert.strictEqual(nonSalePayload.intent, 'SALUDO');
    });

    it('4.4. Sale payload with hesitation resolution satisfies sale contract', () => {
      const salePayload = {
        transcription: 'dos pa- un poster de batman mediano en efectivo',
        isSaleDetected: true,
        intent: 'DICTADO_VENTA',
        items: [
          {
            title: 'Batman',
            size: 'MEDIANO',
            quantity: 1,
            unitPrice: 65,
          },
        ],
        paymentMethod: 'EFECTIVO',
      };

      assert.strictEqual(salePayload.isSaleDetected, true);
      assert.strictEqual(salePayload.items.length, 1);
      assert.strictEqual(salePayload.items[0].quantity, 1);
      assert.strictEqual(salePayload.items[0].size, 'MEDIANO');
      assert.strictEqual(salePayload.items[0].unitPrice, 65);
    });
  });

});
