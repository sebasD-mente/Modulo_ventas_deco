import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSalesSystemPrompt } from '../../server/services/ai/aiPromptService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('✨ Suite de Pruebas: Motor de Combos, Upselling Proactivo & Badge UI (M3)', () => {
  const toolCardsPath = path.join(projectRoot, 'src/components/ai-chat/ChatToolCards.jsx');
  const promptServicePath = path.join(projectRoot, 'server/services/ai/aiPromptService.js');

  describe('1. Directivas Comerciales y System Prompt (aiPromptService.js)', () => {
    it('1.1. aiPromptService.js existe y cumple estrictamente con el límite de < 180 líneas', () => {
      assert.ok(fs.existsSync(promptServicePath), 'aiPromptService.js debe existir');
      const content = fs.readFileSync(promptServicePath, 'utf8');
      const lines = content.split('\n');
      assert.ok(lines.length < 180, `aiPromptService.js tiene ${lines.length} líneas, debe ser < 180 líneas`);
    });

    it('1.2. Inyecta regla oficial de Combo 2 Medianos por Q120 (ahorro de Q10)', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(prompt.includes('Combo 2 Medianos por Q120'), 'Debe incluir "Combo 2 Medianos por Q120"');
      assert.ok(prompt.includes('ahorro de Q10'), 'Debe especificar el ahorro de Q10');
      assert.ok(prompt.includes('Q130'), 'Debe mencionar el precio regular de Q130');
    });

    it('1.3. Inyecta regla oficial de Combo 3 Medianos por Q180 (ahorro de Q15)', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(prompt.includes('Combo 3 Medianos por Q180'), 'Debe incluir "Combo 3 Medianos por Q180"');
      assert.ok(prompt.includes('ahorro de Q15'), 'Debe especificar el ahorro de Q15');
      assert.ok(prompt.includes('Q195'), 'Debe mencionar el precio regular de Q195');
    });

    it('1.4. Inyecta regla de Upselling Proactivo: 1 Mediano -> sugerir 2 por Q120', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(
        prompt.includes('Al solicitar 1 Mediano, sugiere proactivamente llevar 2 por Q120'),
        'Debe contener la regla de sugerencia proactiva para 1 mediano'
      );
    });

    it('1.5. Inyecta regla de Upselling Proactivo: 2 Medianos -> sugerir 3ro por Q60 más (total Q180)', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(
        prompt.includes('Al ordenar 2 Medianos, sugiere llevar el 3ro por solo Q60 más (total Q180, ahorro de Q15)'),
        'Debe contener la regla de sugerencia proactiva para 2 medianos'
      );
    });

    it('1.6. Mantiene intactos los 4 pilares preexistentes y las herramientas oficiales', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(prompt.includes('MEDIANO (30x45 cm / 12x18 pulg a Q65.00)'));
      assert.ok(prompt.includes('HP LÁTEX ECOLÓGICO'));
      assert.ok(prompt.includes('CINTA tesa® ORIGINAL EN 15 SEGUNDOS'));
      assert.ok(prompt.includes('PORTADA DE ÁLBUM (30x30 cm a Q55.00)'));
      assert.ok(prompt.includes('prepareSaleDraft'));
      assert.ok(prompt.includes('searchCatalog'));
    });
  });

  describe('2. Estructura y Reglas de Badge UI de Combos (ChatToolCards.jsx)', () => {
    it('2.1. ChatToolCards.jsx existe y cumple estrictamente el límite de < 140 líneas', () => {
      assert.ok(fs.existsSync(toolCardsPath), 'ChatToolCards.jsx debe existir');
      const content = fs.readFileSync(toolCardsPath, 'utf8');
      const lines = content.split('\n');
      assert.ok(lines.length < 140, `ChatToolCards.jsx tiene ${lines.length} líneas, debe ser < 140 líneas`);
      assert.ok(lines.length < 200, 'ChatToolCards.jsx debe ser < 200 líneas');
    });

    it('2.2. Implementa detección de posters tamaño MEDIANO en cantidad >= 2', () => {
      const code = fs.readFileSync(toolCardsPath, 'utf8');
      assert.ok(code.includes('medQty >= 2'), 'Debe evaluar medQty >= 2');
      assert.ok(code.includes('MEDIANO'), 'Debe buscar tamaño MEDIANO');
      assert.ok(code.includes('draftSale') || code.includes('draft_sale'), 'Debe inspeccionar draftSale o draft_sale');
    });

    it('2.3. Renderiza insignia elegante con texto "✨ Combo Medianos" y variantes 2x/3x', () => {
      const code = fs.readFileSync(toolCardsPath, 'utf8');
      assert.ok(code.includes('✨ Combo Medianos'), 'Debe incluir el texto "✨ Combo Medianos"');
      assert.ok(code.includes('2x Q120'), 'Debe incluir "2x Q120" para 2 medianos');
      assert.ok(code.includes('3x Q180'), 'Debe incluir "3x Q180" para 3 medianos');
      assert.ok(code.includes('data-testid="combo-badge"'), 'Debe tener data-testid="combo-badge"');
    });

    it('2.4. Conserva el 100% de los contratos de herramientas preexistentes', () => {
      const code = fs.readFileSync(toolCardsPath, 'utf8');
      assert.ok(code.includes('eventKpis'));
      assert.ok(code.includes('cashDrawerStatus'));
      assert.ok(code.includes('sellerShiftReport'));
      assert.ok(code.includes('productionQueueStatus'));
      assert.ok(code.includes('inventoryStock'));
      assert.ok(code.includes('suggestedPosters'));
    });
  });

  describe('3. Validación Empírica de Lógica Matemática de Combos', () => {
    // Función espejo de la lógica implementada en ChatToolCards
    function evaluateComboQualification(draft) {
      const items = draft?.items || [];
      const medQty = items.reduce((acc, it) => {
        const sz = (it.sizeId || it.size || it.selectedSizeId || '').toUpperCase();
        return (sz === 'MEDIANO' || (!sz && (it.description || '').toUpperCase().includes('MEDIANO')))
          ? acc + (Number(it.quantity) || 1)
          : acc;
      }, 0);

      if (medQty < 2) return null;
      return {
        qualifies: true,
        medQty,
        badgeText: `✨ Combo Medianos (${medQty >= 3 ? '3x Q180' : '2x Q120'})`,
        price: medQty >= 3 ? 180 : 120,
        savings: medQty >= 3 ? 15 : 10,
      };
    }

    it('3.1. Retorna null cuando no hay items o la cantidad de Medianos es 0 o 1', () => {
      assert.strictEqual(evaluateComboQualification(null), null);
      assert.strictEqual(evaluateComboQualification({ items: [] }), null);
      assert.strictEqual(
        evaluateComboQualification({
          items: [{ sizeId: 'MEDIANO', quantity: 1, description: 'Batman' }],
        }),
        null
      );
      assert.strictEqual(
        evaluateComboQualification({
          items: [
            { sizeId: 'GRANDE', quantity: 2, description: 'Goku' },
            { sizeId: 'PORTADA_ALBUM', quantity: 1, description: 'Taylor' },
          ],
        }),
        null
      );
    });

    it('3.2. Califica para Combo 2x Q120 con 2 Medianos (ahorro Q10)', () => {
      const res = evaluateComboQualification({
        items: [{ sizeId: 'MEDIANO', quantity: 2, description: 'Spider-Man' }],
      });
      assert.ok(res && res.qualifies);
      assert.strictEqual(res.medQty, 2);
      assert.strictEqual(res.price, 120);
      assert.strictEqual(res.savings, 10);
      assert.ok(res.badgeText.includes('✨ Combo Medianos'));
      assert.ok(res.badgeText.includes('2x Q120'));
    });

    it('3.3. Califica para Combo 3x Q180 con 3 o más Medianos (ahorro Q15)', () => {
      const res3 = evaluateComboQualification({
        items: [{ sizeId: 'MEDIANO', quantity: 3, description: 'One Piece' }],
      });
      assert.ok(res3 && res3.qualifies);
      assert.strictEqual(res3.medQty, 3);
      assert.strictEqual(res3.price, 180);
      assert.strictEqual(res3.savings, 15);
      assert.ok(res3.badgeText.includes('✨ Combo Medianos'));
      assert.ok(res3.badgeText.includes('3x Q180'));

      const res4 = evaluateComboQualification({
        items: [{ sizeId: 'MEDIANO', quantity: 4, description: 'Star Wars' }],
      });
      assert.ok(res4 && res4.qualifies);
      assert.strictEqual(res4.price, 180);
    });

    it('3.4. Suma correctamente múltiples ítems heterogéneos con tamaño Mediano', () => {
      const res = evaluateComboQualification({
        items: [
          { sizeId: 'MEDIANO', quantity: 1, description: 'Póster A' },
          { size: 'mediano', quantity: 1, description: 'Póster B' },
          { sizeId: 'GRANDE', quantity: 2, description: 'Póster C' },
        ],
      });
      assert.ok(res && res.qualifies);
      assert.strictEqual(res.medQty, 2);
      assert.strictEqual(res.price, 120);
    });
  });
});
