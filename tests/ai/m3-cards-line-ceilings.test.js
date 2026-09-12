import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('📏 M3 Cards Line Ceilings & Structural Integrity', () => {
  const toolCardsPath = path.join(projectRoot, 'src/components/ai-chat/ChatToolCards.jsx');
  const draftCardPath = path.join(projectRoot, 'src/components/ai-chat/ChatDraftCard.jsx');
  const swapModalPath = path.join(projectRoot, 'src/components/ai-chat/ChatSwapModal.jsx');

  it('1. ChatToolCards.jsx existe y cumple estrictamente el límite de < 140 líneas', () => {
    assert.ok(fs.existsSync(toolCardsPath), 'ChatToolCards.jsx debe existir');
    const content = fs.readFileSync(toolCardsPath, 'utf8');
    const lines = content.split('\n');
    assert.ok(lines.length < 140, `ChatToolCards.jsx tiene ${lines.length} líneas, debe ser < 140 líneas`);
    assert.ok(lines.length < 200, 'ChatToolCards.jsx debe ser < 200 líneas');
  });

  it('2. ChatDraftCard.jsx existe y cumple estrictamente el límite de < 140 líneas', () => {
    assert.ok(fs.existsSync(draftCardPath), 'ChatDraftCard.jsx debe existir');
    const content = fs.readFileSync(draftCardPath, 'utf8');
    const lines = content.split('\n');
    assert.ok(lines.length < 140, `ChatDraftCard.jsx tiene ${lines.length} líneas, debe ser < 140 líneas`);
    assert.ok(lines.length < 200, 'ChatDraftCard.jsx debe ser < 200 líneas');
  });

  it('3. ChatSwapModal.jsx existe y cumple estrictamente el límite de < 100 líneas', () => {
    assert.ok(fs.existsSync(swapModalPath), 'ChatSwapModal.jsx debe existir');
    const content = fs.readFileSync(swapModalPath, 'utf8');
    const lines = content.split('\n');
    assert.ok(lines.length < 100, `ChatSwapModal.jsx tiene ${lines.length} líneas, debe ser < 100 líneas`);
    assert.ok(lines.length < 200, 'ChatSwapModal.jsx debe ser < 200 líneas');
  });

  it('4. ChatToolCards.jsx implementa genuinamente las 5 tarjetas de herramientas y sugerencias de catálogo', () => {
    const code = fs.readFileSync(toolCardsPath, 'utf8');

    // 5 DB tool cards
    assert.ok(code.includes('eventKpis'), 'Debe renderizar eventKpis');
    assert.ok(code.includes('cashDrawerStatus'), 'Debe renderizar cashDrawerStatus');
    assert.ok(code.includes('sellerShiftReport'), 'Debe renderizar sellerShiftReport');
    assert.ok(code.includes('productionQueueStatus'), 'Debe renderizar productionQueueStatus');
    assert.ok(code.includes('inventoryStock'), 'Debe renderizar inventoryStock');

    // Suggested posters catalog grid
    assert.ok(code.includes('suggestedPosters'), 'Debe renderizar suggestedPosters');
    assert.ok(code.includes('+ Vender'), 'Debe incluir botón + Vender');

    // Required Lucide icons
    assert.ok(code.includes('BarChart3'), 'Debe usar BarChart3');
    assert.ok(code.includes('Wallet'), 'Debe usar Wallet');
    assert.ok(code.includes('Users'), 'Debe usar Users');
    assert.ok(code.includes('Printer'), 'Debe usar Printer');
    assert.ok(code.includes('Package'), 'Debe usar Package');
  });

  it('5. ChatDraftCard.jsx implementa gestión interactiva Human-in-the-Loop', () => {
    const code = fs.readFileSync(draftCardPath, 'utf8');

    // Required icons
    assert.ok(code.includes('ShoppingBag'), 'Debe usar ShoppingBag');
    assert.ok(code.includes('RefreshCw'), 'Debe usar RefreshCw');
    assert.ok(code.includes('Trash2'), 'Debe usar Trash2');
    assert.ok(code.includes('X'), 'Debe usar X');
    assert.ok(code.includes('Plus'), 'Debe usar Plus');
    assert.ok(code.includes('Minus'), 'Debe usar Minus');
    assert.ok(code.includes('CheckCircle2'), 'Debe usar CheckCircle2');

    // Controls
    assert.ok(code.includes('DEFAULT_EVENT_SIZES'), 'Debe importar DEFAULT_EVENT_SIZES');
    assert.ok(code.includes('EFECTIVO'), 'Debe soportar método EFECTIVO');
    assert.ok(code.includes('TARJETA'), 'Debe soportar método TARJETA');
    assert.ok(code.includes('TRANSFERENCIA'), 'Debe soportar método TRANSFERENCIA');
    assert.ok(code.includes('Descartar'), 'Debe incluir acción Descartar');
    assert.ok(code.includes('Modificar'), 'Debe incluir acción Modificar');
    assert.ok(code.includes('Confirmar Venta'), 'Debe incluir acción Confirmar Venta');
  });

  it('6. ChatSwapModal.jsx implementa modal de sustitución con búsqueda reactiva', () => {
    const code = fs.readFileSync(swapModalPath, 'utf8');

    // Required icons
    assert.ok(code.includes('Search'), 'Debe usar Search');
    assert.ok(code.includes('RefreshCw'), 'Debe usar RefreshCw');
    assert.ok(code.includes('X'), 'Debe usar X');
    assert.ok(code.includes('Loader2'), 'Debe usar Loader2');

    // Structure
    assert.ok(code.includes('backdrop-blur-md'), 'Debe incluir backdrop-blur-md');
    assert.ok(code.includes('swapQuery'), 'Debe manejar swapQuery');
    assert.ok(code.includes('swapResults'), 'Debe renderizar swapResults');
    assert.ok(code.includes('isSearchingSwap'), 'Debe manejar estado isSearchingSwap');
  });
});
