import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../server/config/prisma.js';
import { executeToolCall, streamClosedLoopFollowUp, buildFallbackSummaries } from '../../server/services/ai/aiClosedLoopService.js';
import { constructDraftPayload, salesAssistantTools, searchCatalogDeclaration } from '../../server/services/ai/aiToolsService.js';
import { buildSalesSystemPrompt } from '../../server/services/ai/aiPromptService.js';
import { invalidateCatalogCache } from '../../server/services/webCatalogService.js';

describe('🔥 EMPIRICAL CHALLENGER: Fase 3 In-Depth Adversarial Stress Harness', () => {
  let originalPrisma = {};

  beforeEach(() => {
    invalidateCatalogCache();
    originalPrisma = {
      productFindMany: prisma.product?.findMany,
      productUpsert: prisma.product?.upsert,
      eventFindFirst: prisma.event?.findFirst,
      eventFindUnique: prisma.event?.findUnique,
    };
    if (prisma.product) {
      prisma.product.findMany = async () => [
        {
          id: 'spiderman-mock-1',
          name: 'Spider-Man 🕷️ "Limited Ed"',
          category: 'CÓMICS',
          basePrice: 65,
          sizes: [{ sizeId: 'MEDIANO', precio: 65 }, { sizeId: 'GRANDE', precio: 125 }],
        },
      ];
      prisma.product.upsert = async ({ create }) => ({ id: 'mock-upsert', ...create });
    }
    if (prisma.event) {
      prisma.event.findFirst = async () => ({ id: 'test-event', name: 'Test Event', status: 'ACTIVO' });
      prisma.event.findUnique = async () => ({ id: 'test-event', name: 'Test Event', status: 'ACTIVO' });
    }
  });

  afterEach(() => {
    invalidateCatalogCache();
    if (prisma.product) {
      if (originalPrisma.productFindMany) prisma.product.findMany = originalPrisma.productFindMany;
      if (originalPrisma.productUpsert) prisma.product.upsert = originalPrisma.productUpsert;
    }
    if (prisma.event) {
      if (originalPrisma.eventFindFirst) prisma.event.findFirst = originalPrisma.eventFindFirst;
      if (originalPrisma.eventFindUnique) prisma.event.findUnique = originalPrisma.eventFindUnique;
    }
  });

  // =========================================================================
  // 1. BOUNDARY & STRESS TESTS FOR aiClosedLoopService & aiToolsService
  // =========================================================================
  describe('1. Resiliencia Extrema de Tools y Closed-Loop', () => {

    it('1.1 executeToolCall sobrevive a llamadas con args nulos, vacíos o indefinidos', async () => {
      const nullCall = { name: 'prepareSaleDraft', args: null };
      const resNull = await executeToolCall(nullCall, { tenantId: 'test' });
      assert.strictEqual(resNull.event, null);
      assert.strictEqual(resNull.toolRecord, null);

      const emptyObjCall = { name: 'prepareSaleDraft', args: {} };
      const resEmpty = await executeToolCall(emptyObjCall, { tenantId: 'test', message: '' });
      assert.ok(resEmpty.event);
      assert.strictEqual(resEmpty.event.type, 'draft_sale');
      assert.strictEqual(resEmpty.toolRecord.result.total, 0);

      const unknownCall = { name: 'toolInexistenteRandom', args: { foo: 'bar' } };
      const resUnknown = await executeToolCall(unknownCall, { tenantId: 'test' });
      assert.strictEqual(resUnknown.event, null);
      assert.strictEqual(resUnknown.toolRecord, null);
    });

    it('1.2 searchCatalogDeclaration NO debe contener el parámetro muerto mensaje_conversacional', () => {
      const props = searchCatalogDeclaration.parameters.properties;
      assert.strictEqual(props.mensaje_conversacional, undefined, 'mensaje_conversacional debe haber sido eliminado');
      assert.ok(props.query, 'query debe existir');
      assert.ok(props.category, 'category debe existir');
      assert.deepStrictEqual(searchCatalogDeclaration.parameters.required, ['query']);
    });

    it('1.3 streamClosedLoopFollowUp con trailingTextTokens > 0 no debe re-emitir follow-up tokens', async () => {
      let yieldedAny = false;
      const gen = streamClosedLoopFollowUp({
        executedTools: [{ name: 'prepareSaleDraft', result: { total: 65, items: [] } }],
        formattedContents: [],
        systemInstruction: 'Prompt',
        trailingTextTokens: 3,
      });
      for await (const chunk of gen) {
        yieldedAny = true;
      }
      assert.strictEqual(yieldedAny, false, 'No debe emitir nada si trailingTextTokens > 0');
    });

    it('1.4 streamClosedLoopFollowUp con executedTools vacío no emite nada', async () => {
      let yieldedAny = false;
      const gen = streamClosedLoopFollowUp({
        executedTools: [],
        formattedContents: [],
        systemInstruction: 'Prompt',
        trailingTextTokens: 0,
      });
      for await (const chunk of gen) {
        yieldedAny = true;
      }
      assert.strictEqual(yieldedAny, false, 'No debe emitir nada si executedTools está vacío');
    });

    it('1.5 constructDraftPayload procesa arrays heterogéneos y caracteres especiales sin romper', async () => {
      const weirdPayload = {
        items: [
          null,
          undefined,
          { productName: '<script>alert("xss")</script>', quantity: 2, size: 'GRANDE', unitPrice: 125 },
          { productName: 'Spider-Man 🕷️ "Limited Ed"', quantity: 2, size: 'PEQUENO', unitPrice: 35 },
          { productName: 'Póster con caracteres extraños: ¡¿&%$#!', quantity: 1, size: 'MEDIANO', unitPrice: 65 },
        ],
        paymentMethod: 'TARJETA',
        notes: 'Pago con tarjeta cliente VIP',
      };
      const draft = await constructDraftPayload('tenant-test', weirdPayload, 'quiero pagar con tarjeta');
      assert.ok(draft);
      assert.strictEqual(draft.paymentMethod, 'TARJETA');
      assert.ok(draft.items.length >= 3, 'Debe haber filtrado los nulos/undefined');
    });

    it('1.6 buildFallbackSummaries genera textos limpios sin alucinaciones para todas las tools', () => {
      const tools = [
        { name: 'prepareSaleDraft', result: { total: 130, items: [{ quantity: 2, description: 'Messi', unitPrice: 65 }] } },
        { name: 'searchCatalog', result: { matchesCount: 4 } },
        { name: 'checkInventoryStock', result: { summary: 'Stock disponible en stand.' } },
        { name: 'getCashDrawerStatus', result: { summaryText: 'Gaveta: Q500.' } },
        { name: 'getSellerShiftReport', result: { summaryText: 'Ventas del turno: 5.' } },
        { name: 'getProductionQueueStatus', result: { summary: 'Cola óptima.' } },
        { name: 'getEventKPIs', result: { totalAmount: 1200, totalTransactions: 8 } },
      ];
      const summaries = buildFallbackSummaries(tools);
      assert.strictEqual(summaries.length, 7);
      assert.ok(summaries[0].includes('Total:'));
      assert.ok(summaries[1].includes('Mostrando 4 opciones'));
      assert.ok(summaries[2].includes('Stock disponible'));
    });
  });

  // =========================================================================
  // 2. PROMPT DIRECTIVES & IDENTITY ADVERSARIAL STRESS
  // =========================================================================
  describe('2. Directivas del System Prompt (aiPromptService.js)', () => {

    it('2.1 buildSalesSystemPrompt instruye respuestas de 1 a 2 líneas post-borrador', () => {
      const prompt = buildSalesSystemPrompt({
        event: { name: 'Comic Con 2026', location: 'Pabellón A' },
        resolvedContextData: { vendedorNombre: 'Sebastian' },
        pendingDraft: null,
      });

      assert.ok(prompt.includes('1 a 2 líneas breves'), 'Debe instruir 1-2 líneas');
      assert.ok(prompt.includes('PROHIBIDO terminantemente recitar la lista exhaustiva'), 'Debe prohibir recitar ítems en texto');
      assert.ok(prompt.includes('ChatDraftCard'), 'Debe referenciar la visibilidad interactiva en tarjeta');
      assert.ok(prompt.includes('PRECIOS 100% FIJOS'), 'Debe enfatizar precios fijos');
      assert.ok(!prompt.toLowerCase().includes('j.a.r.v.i.s'), 'Cero mención de JARVIS');
    });

    it('2.2 buildSalesSystemPrompt con pendingDraft inyecta contexto interactivo y directivas de mutación', () => {
      const draft = {
        items: [{ baseTitle: 'Goku Ultra Instinto', sizeId: 'GRANDE', quantity: 1, unitPrice: 125, subtotal: 125 }],
        total: 125,
        paymentMethod: 'EFECTIVO',
      };
      const prompt = buildSalesSystemPrompt({
        event: { name: 'Comic Con 2026' },
        resolvedContextData: { vendedorNombre: 'Ana' },
        pendingDraft: draft,
      });

      assert.ok(prompt.includes('BORRADOR ACTIVO EN PANTALLA'), 'Debe contener el encabezado de borrador activo');
      assert.ok(prompt.includes('Goku Ultra Instinto'), 'Debe listar el ítem del borrador activo');
      assert.ok(prompt.includes('EDICIÓN CONVERSACIONAL EN CURSO'), 'Debe instruir modo edición');
    });
  });

  // =========================================================================
  // 3. FRONTEND SOURCE & TOUCH TARGET COMPLIANCE
  // =========================================================================
  describe('3. Ergonomía Táctil y WCAG 2.1 AAA (>= 44px)', () => {

    it('3.1 ChatDraftCard.jsx y DraftItemRow.jsx cumplen áreas táctiles mínimas de 44px', () => {
      const draftCardContent = fs.readFileSync(path.resolve('src/components/ai-chat/ChatDraftCard.jsx'), 'utf-8');
      const itemRowContent = fs.readFileSync(path.resolve('src/components/ai-chat/DraftItemRow.jsx'), 'utf-8');

      // Botón Confirmar Venta debe ser >= 48px
      assert.ok(draftCardContent.includes('min-h-[48px]'), 'Confirmar Venta debe tener min-h-[48px]');

      // Botones de método de pago y acciones deben tener min-h-[44px]
      assert.ok(draftCardContent.includes('min-h-[44px]'), 'Botones de pago/descartar/modificar deben tener min-h-[44px]');

      // Botones de cantidad (+ y -) y eliminar en DraftItemRow deben tener min-w-[44px] y min-h-[44px]
      assert.ok(itemRowContent.includes('min-w-[44px] min-h-[44px]'), 'Controles de cantidad deben ser >= 44x44px');
    });

    it('3.2 ChatToolCards.jsx cumple áreas táctiles mínimas en botones interactivos', () => {
      const toolCardsContent = fs.readFileSync(path.resolve('src/components/ai-chat/ChatToolCards.jsx'), 'utf-8');
      assert.ok(toolCardsContent.includes('min-h-[44px]'), 'Botones de acción en ChatToolCards deben tener min-h-[44px]');
    });

    it('3.3 useAiChatStream.js sincroniza pendingDraftRef en todas las operaciones críticas', () => {
      const hookContent = fs.readFileSync(path.resolve('src/components/ai-chat/hooks/useAiChatStream.js'), 'utf-8');
      assert.ok(hookContent.includes('const pendingDraftRef = useRef(pendingDraft);'), 'Debe inicializar pendingDraftRef');
      assert.ok(hookContent.includes('pendingDraftRef.current = pendingDraft;'), 'Debe mantener sincronizado pendingDraftRef');
      assert.ok(hookContent.includes('pendingDraft: pendingDraftRef.current || null'), 'handleSendText debe enviar pendingDraftRef.current');
      assert.ok(hookContent.includes('const draft = pendingDraftRef.current;'), 'confirmPendingSale debe leer pendingDraftRef.current');
    });
  });

  // =========================================================================
  // 4. LINE CEILINGS FINAL VERIFICATION
  // =========================================================================
  describe('4. Verificación Definitiva de Techos de Líneas', () => {
    const limits = [
      { file: 'src/components/ai-chat/ChatDraftCard.jsx', max: 140, strict: true },
      { file: 'src/components/ai-chat/hooks/useAiChatStream.js', max: 160, strict: true },
      { file: 'src/components/ai-chat/ChatToolCards.jsx', max: 140, strict: true },
      { file: 'src/components/ai-chat/ChatSwapModal.jsx', max: 100, strict: true },
      { file: 'server/services/ai/aiStreamService.js', max: 200, strict: false },
      { file: 'server/services/ai/aiClosedLoopService.js', max: 200, strict: false },
    ];

    for (const { file, max, strict } of limits) {
      it(`${file} cumple límite (${strict ? '<' : '<='} ${max} líneas)`, () => {
        const lines = fs.readFileSync(path.resolve(file), 'utf-8').split('\n').length;
        if (strict) {
          assert.ok(lines < max, `${file} tiene ${lines} líneas, debe ser < ${max}`);
        } else {
          assert.ok(lines <= max, `${file} tiene ${lines} líneas, debe ser <= ${max}`);
        }
      });
    }
  });
});
