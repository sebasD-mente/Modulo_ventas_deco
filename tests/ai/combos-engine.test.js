import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSalesSystemPrompt } from '../../server/services/ai/aiPromptService.js';
import { CANONICAL_PRICE_MAP } from '../../src/services/catalogCacheService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('🛡️ Suite de Pruebas: Política de Precios 100% Fijos, Cero Combos y Catálogo Real', () => {
  const toolCardsPath = path.join(projectRoot, 'src/components/ai-chat/ChatToolCards.jsx');
  const promptServicePath = path.join(projectRoot, 'server/services/ai/aiPromptService.js');

  describe('1. Directivas de Precios Fijos y Formatos Reales (aiPromptService.js)', () => {
    it('1.1. aiPromptService.js cumple con el límite de < 180 líneas', () => {
      assert.ok(fs.existsSync(promptServicePath), 'aiPromptService.js debe existir');
      const content = fs.readFileSync(promptServicePath, 'utf8');
      const lines = content.split('\n');
      assert.ok(lines.length < 180, `aiPromptService.js tiene ${lines.length} líneas, debe ser < 180 líneas`);
    });

    it('1.2. Exige precios 100% fijos y prohíbe combos no autorizados (2x Q120, 3x Q180)', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(prompt.includes('PRECIOS 100% FIJOS'), 'Debe exigir política de precios fijos');
      assert.ok(prompt.includes('PROHIBIDO 2x Q120, 3x Q180'), 'Debe prohibir 2x Q120 y 3x Q180');
      assert.ok(prompt.includes('Q130 (2 × Q65)'), 'Debe confirmar que 2 medianos son exactamente Q130');
      assert.ok(prompt.includes('Q195 (3 × Q65)'), 'Debe confirmar que 3 medianos son exactamente Q195');
    });

    it('1.3. Restringe Portada de Álbum exclusivamente a discos musicales y 30x30 cm', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(prompt.includes('PORTADA DE ÁLBUM (30x30 cm a Q55.00)'), 'Debe definir portada de álbum a Q55');
      assert.ok(prompt.includes('PÓSTERS NORMALES: Se fabrican en los 5 tamaños estándar'), 'Debe especificar tamaños estándar para pósters normales');
      assert.ok(prompt.includes('NO se fabrican en 30x30 cm / Portada de Álbum'), 'Debe prohibir 30x30 en pósters normales');
    });

    it('1.4. Erradica la obsesión por el tamaño Mediano promoviendo variedad equilibrada', () => {
      const prompt = buildSalesSystemPrompt({});
      assert.ok(prompt.includes('Cero obsesión con el Mediano'), 'Debe prohibir sesgo forzado al mediano');
      assert.ok(prompt.includes('VARIEDAD'), 'Debe instruir presentación equilibrada');
    });
  });

  describe('2. Integridad de UI sin Combos Falsos (ChatToolCards.jsx)', () => {
    it('2.1. ChatToolCards.jsx existe y cumple con el límite de < 140 líneas', () => {
      assert.ok(fs.existsSync(toolCardsPath), 'ChatToolCards.jsx debe existir');
      const content = fs.readFileSync(toolCardsPath, 'utf8');
      const lines = content.split('\n');
      assert.ok(lines.length < 140, `ChatToolCards.jsx tiene ${lines.length} líneas, debe ser < 140 líneas`);
    });

    it('2.2. No incluye combo-badge ni textos de descuentos no autorizados', () => {
      const code = fs.readFileSync(toolCardsPath, 'utf8');
      assert.ok(!code.includes('data-testid="combo-badge"'), 'No debe existir el elemento combo-badge');
      assert.ok(!code.includes('2x Q120'), 'No debe existir texto 2x Q120');
      assert.ok(!code.includes('3x Q180'), 'No debe existir texto 3x Q180');
    });

    it('2.3. Conserva el 100% de los contratos de herramientas oficiales', () => {
      const code = fs.readFileSync(toolCardsPath, 'utf8');
      assert.ok(code.includes('eventKpis'));
      assert.ok(code.includes('cashDrawerStatus'));
      assert.ok(code.includes('sellerShiftReport'));
      assert.ok(code.includes('productionQueueStatus'));
      assert.ok(code.includes('inventoryStock'));
      assert.ok(code.includes('suggestedPosters'));
    });
  });

  describe('3. Verificación Matemática de Precios Fijos (Cero Sacrificio de Margen)', () => {
    function calculateExactTotal(items) {
      return (items || []).reduce((acc, it) => {
        const sz = (it.sizeId || it.size || 'MEDIANO').toUpperCase();
        const unitPrice = CANONICAL_PRICE_MAP[sz] || 65;
        const qty = Number(it.quantity) || 1;
        return acc + (qty * unitPrice);
      }, 0);
    }

    it('3.1. 2 Medianos suman exactamente Q130 (2 × Q65)', () => {
      const total = calculateExactTotal([{ sizeId: 'MEDIANO', quantity: 2 }]);
      assert.strictEqual(total, 130);
    });

    it('3.2. 3 Medianos suman exactamente Q195 (3 × Q65)', () => {
      const total = calculateExactTotal([{ sizeId: 'MEDIANO', quantity: 3 }]);
      assert.strictEqual(total, 195);
    });

    it('3.3. Carrito heterogéneo preserva precios exactos por catálogo', () => {
      const total = calculateExactTotal([
        { sizeId: 'MINI', quantity: 1 },        // Q25
        { sizeId: 'PEQUENO', quantity: 1 },     // Q35
        { sizeId: 'PORTADA_ALBUM', quantity: 1 },// Q55
        { sizeId: 'MEDIANO', quantity: 2 },     // Q130
        { sizeId: 'GRANDE', quantity: 1 },      // Q125
        { sizeId: 'GIGANTE', quantity: 1 },     // Q180
      ]);
      assert.strictEqual(total, 25 + 35 + 55 + 130 + 125 + 180); // Q550
    });
  });
});
