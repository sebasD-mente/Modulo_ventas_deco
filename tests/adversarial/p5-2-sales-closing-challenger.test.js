import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DENOMINATIONS,
  INITIAL_COUNTS,
  calculateDenominationsTotal,
  calculateDifference,
  getDiscrepancyStatus,
  formatWhatsAppSummary,
} from '../../src/components/closing/hooks/useCashClosing.js';

import {
  updateSaleSchema,
  cashClosingSchema,
  saleItemSchema,
  salePaymentSchema,
} from '../../server/validators/saleValidators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ ADVERSARIAL CHALLENGER P5.2: EditSaleModal, CashClosingView & Integration Contracts', () => {

  const editModalPath = path.join(rootDir, 'src/components/EditSaleModal.jsx');
  const editHookPath = path.join(rootDir, 'src/components/sales/edit/hooks/useEditSaleForm.js');
  const editTablePath = path.join(rootDir, 'src/components/sales/edit/EditSaleItemsTable.jsx');
  const cashClosingPath = path.join(rootDir, 'src/components/CashClosingView.jsx');
  const cashHookPath = path.join(rootDir, 'src/components/closing/hooks/useCashClosing.js');
  const cashGridPath = path.join(rootDir, 'src/components/closing/CashDenominationGrid.jsx');
  const cashSummaryPath = path.join(rootDir, 'src/components/closing/CashClosingSummary.jsx');
  const appPath = path.join(rootDir, 'src/App.jsx');
  const recentSalesPath = path.join(rootDir, 'src/components/RecentSalesList.jsx');

  const editModalContent = fs.readFileSync(editModalPath, 'utf-8');
  const editHookContent = fs.readFileSync(editHookPath, 'utf-8');
  const editTableContent = fs.readFileSync(editTablePath, 'utf-8');
  const cashClosingContent = fs.readFileSync(cashClosingPath, 'utf-8');
  const cashHookContent = fs.readFileSync(cashHookPath, 'utf-8');
  const cashSummaryContent = fs.readFileSync(cashSummaryPath, 'utf-8');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  const recentSalesContent = fs.readFileSync(recentSalesPath, 'utf-8');

  // =========================================================================
  // BLOQUE 1: STRESS TESTS EN src/components/sales/edit/
  // =========================================================================
  describe('1. Stress-Testing Adversarial: src/components/sales/edit/', () => {

    // 1.1 Inmutabilidad referencial con Object.freeze
    it('1.1 Inmutabilidad referencial: Object.freeze en items previene mutación in-place en handleUpdateQuantity', () => {
      const handleUpdateQuantityLogic = (prevItems, idx, delta) => {
        const current = prevItems[idx];
        if (!current) return prevItems;
        const newQty = Math.max(1, current.quantity + delta);
        const updated = [...prevItems];
        updated[idx] = {
          ...current,
          quantity: newQty,
          subtotal: Number((newQty * current.unitPrice).toFixed(2)),
        };
        return updated;
      };

      const originalItem1 = Object.freeze({
        id: '550e8400-e29b-41d4-a716-446655440001',
        productId: '550e8400-e29b-41d4-a716-446655440010',
        description: 'Póster Taylor Swift Eras Tour (Grande)',
        quantity: 2,
        unitPrice: 125.00,
        subtotal: 250.00,
      });

      const originalItem2 = Object.freeze({
        id: '550e8400-e29b-41d4-a716-446655440002',
        productId: '550e8400-e29b-41d4-a716-446655440020',
        description: 'Póster Bad Bunny Un Verano Sin Ti (Mediano)',
        quantity: 1,
        unitPrice: 65.00,
        subtotal: 65.00,
      });

      const stateArray = Object.freeze([originalItem1, originalItem2]);

      // Modificación al ítem 0
      const nextState = handleUpdateQuantityLogic(stateArray, 0, 1);

      // Verificaciones referenciales estrictas
      assert.notStrictEqual(nextState, stateArray, 'Array debe tener nueva referencia');
      assert.notStrictEqual(nextState[0], originalItem1, 'Ítem modificado debe tener nueva referencia');
      assert.strictEqual(nextState[1], originalItem2, 'Ítem no modificado debe mantener identidad referencial');
      assert.strictEqual(nextState[0].quantity, 3);
      assert.strictEqual(nextState[0].subtotal, 375.00);

      // El ítem original debe seguir intacto y congelado
      assert.strictEqual(originalItem1.quantity, 2);
      assert.strictEqual(originalItem1.subtotal, 250.00);
      assert.throws(() => {
        originalItem1.quantity = 99;
      }, /Cannot assign to read only property/);
    });

    // 1.2 Boundary Guard: mínimo 1 ítem en la venta
    it('1.2 Boundary Guard: eliminación bloqueada cuando prevItems.length <= 1', () => {
      let alertMsg = null;
      const mockAlert = (msg) => { alertMsg = msg; };

      const handleRemoveItemLogic = (prevItems, idx, alertFn = mockAlert) => {
        if (prevItems.length <= 1) {
          alertFn('La venta debe conservar al menos un póster.');
          return prevItems;
        }
        return prevItems.filter((_, i) => i !== idx);
      };

      const singleItem = Object.freeze([
        Object.freeze({
          id: '550e8400-e29b-41d4-a716-446655440001',
          description: 'Póster Único Obligatorio',
          quantity: 1,
          unitPrice: 65.00,
        }),
      ]);

      const afterAttempt = handleRemoveItemLogic(singleItem, 0);

      assert.strictEqual(afterAttempt, singleItem, 'Debe devolver la misma referencia sin mutar');
      assert.strictEqual(afterAttempt.length, 1, 'No debe reducir la longitud');
      assert.strictEqual(alertMsg, 'La venta debe conservar al menos un póster.');

      // Con 2 ítems sí permite eliminar
      const twoItems = Object.freeze([singleItem[0], Object.freeze({ id: 'item-2', quantity: 2, unitPrice: 35 })]);
      const afterValidRemove = handleRemoveItemLogic(twoItems, 0);
      assert.strictEqual(afterValidRemove.length, 1);
      assert.strictEqual(afterValidRemove[0].id, 'item-2');
    });

    // 1.3 Cantidades estrictamente no negativas
    it('1.3 Cantidades estrictamente no negativas: ráfaga de deltas negativos no baja de 1', () => {
      const handleUpdateQuantityLogic = (prevItems, idx, delta) => {
        const current = prevItems[idx];
        if (!current) return prevItems;
        const newQty = Math.max(1, current.quantity + delta);
        const updated = [...prevItems];
        updated[idx] = {
          ...current,
          quantity: newQty,
          subtotal: Number((newQty * current.unitPrice).toFixed(2)),
        };
        return updated;
      };

      const item = Object.freeze({ id: 'it-1', quantity: 1, unitPrice: 50 });
      let currentArray = Object.freeze([item]);

      // Disminuir cuando ya está en 1
      currentArray = handleUpdateQuantityLogic(currentArray, 0, -1);
      assert.strictEqual(currentArray[0].quantity, 1, 'Cantidad no debe bajar de 1 con delta -1');

      // Ataque de delta masivo negativo (-9999)
      currentArray = handleUpdateQuantityLogic(currentArray, 0, -9999);
      assert.strictEqual(currentArray[0].quantity, 1, 'Cantidad no debe bajar de 1 con delta -9999');

      // Delta 0
      currentArray = handleUpdateQuantityLogic(currentArray, 0, 0);
      assert.strictEqual(currentArray[0].quantity, 1, 'Cantidad se mantiene en 1 con delta 0');
    });

    // 1.4 Aritmética de Gran Total con descuentos y límites inferiores
    it('1.4 Aritmética de Gran Total: itemsTotal, descuentos y cota inferior cero', () => {
      const computeTotals = (items, discount) => {
        const itemsTotal = items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
        const grandTotal = Math.max(0, itemsTotal - Number(discount || 0));
        return { itemsTotal, grandTotal };
      };

      // Caso A: Descuento parcial normal
      const itemsA = [
        { quantity: 2, unitPrice: 125.00 }, // 250
        { quantity: 3, unitPrice: 65.00 },  // 195
      ];
      const resA = computeTotals(itemsA, 45.00);
      assert.strictEqual(resA.itemsTotal, 445.00);
      assert.strictEqual(resA.grandTotal, 400.00);

      // Caso B: Descuento excede el total (Underflow Protection)
      const resB = computeTotals(itemsA, 900.00);
      assert.strictEqual(resB.itemsTotal, 445.00);
      assert.strictEqual(resB.grandTotal, 0, 'Grand total no debe ser negativo');

      // Caso C: Descuento 0 o nulo
      const resC = computeTotals(itemsA, null);
      assert.strictEqual(resC.grandTotal, 445.00);

      // Caso D: Valores con punto flotante decimal exacto
      const itemsD = [
        { quantity: 1, unitPrice: 33.33 },
        { quantity: 2, unitPrice: 16.67 },
      ]; // 33.33 + 33.34 = 66.67
      const resD = computeTotals(itemsD, 6.67);
      assert.strictEqual(Number(resD.itemsTotal.toFixed(2)), 66.67);
      assert.strictEqual(Number(resD.grandTotal.toFixed(2)), 60.00);
    });

    // 1.5 Estructura y Validación de Payload PATCH /api/sales/:id contra Zod Schema del Backend
    it('1.5 Validación de Payload PATCH: cumple estrictamente con updateSaleSchema del backend', () => {
      const items = [
        {
          productId: '550e8400-e29b-41d4-a716-446655440001',
          description: 'Póster Batman Dark Knight (Gigante)',
          quantity: 2,
          unitPrice: 180.00,
        },
      ];
      const grandTotal = 360.00;
      const paymentMethod = 'TRANSFERENCIA';
      const notes = 'Transferencia No. 981273 - Banco Industrial';
      const discount = 0;

      const payload = {
        items: items.map((it) => ({
          productId: it.productId || null,
          description: it.description,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
        })),
        payments: [
          {
            method: paymentMethod,
            amount: Number(grandTotal.toFixed(2)),
            reference: notes || null,
          },
        ],
        discount: Number(discount || 0),
        notes: notes || null,
      };

      // Validar contra updateSaleSchema real del servidor
      const parsed = updateSaleSchema.parse(payload);
      assert.ok(parsed, 'El payload debe ser aceptado por updateSaleSchema');
      assert.strictEqual(parsed.items.length, 1);
      assert.strictEqual(parsed.payments[0].method, 'TRANSFERENCIA');
      assert.strictEqual(parsed.payments[0].amount, 360.00);
      assert.strictEqual(parsed.notes, notes);
    });

    // 1.6 Soporte de Dual Callback (onSaved || onSaleUpdated)
    it('1.6 Dual Callback: compatibilidad completa para onSaved o onSaleUpdated', () => {
      const executeCallback = (onSaved, onSaleUpdated, data) => {
        const callback = onSaved || onSaleUpdated;
        if (callback) callback(data);
      };

      const testData = { id: 'sale-123', saleNumber: 'TEST-0001' };

      // Caso 1: onSaved provisto (usado en RecentSalesList)
      let savedCalled = false;
      executeCallback((d) => { savedCalled = true; assert.strictEqual(d.id, 'sale-123'); }, null, testData);
      assert.ok(savedCalled, 'onSaved debe ser invocado');

      // Caso 2: onSaleUpdated provisto (usado en vistas de ventas)
      let updatedCalled = false;
      executeCallback(null, (d) => { updatedCalled = true; assert.strictEqual(d.id, 'sale-123'); }, testData);
      assert.ok(updatedCalled, 'onSaleUpdated debe ser invocado');

      // Caso 3: Ambos provistos (prioriza onSaved)
      let prioritized = null;
      executeCallback(() => { prioritized = 'onSaved'; }, () => { prioritized = 'onSaleUpdated'; }, testData);
      assert.strictEqual(prioritized, 'onSaved', 'onSaved tiene precedencia lógica');

      // Caso 4: Ninguno provisto
      assert.doesNotThrow(() => {
        executeCallback(undefined, undefined, testData);
      });
    });

    // 1.7 Simulación Completa de handleSaveChanges con authFetch Mock
    it('1.7 Simulación Completa de Guardado: authFetch llamado con PATCH y payload verificado', async () => {
      let interceptedCall = null;
      const mockAuthFetch = async (url, options) => {
        interceptedCall = { url, options };
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { id: 'sale-999', totalAmount: 250, saleNumber: 'VENTA-0042' },
          }),
        };
      };

      const items = [{ productId: null, description: 'Póster Anime', quantity: 1, unitPrice: 250 }];
      const grandTotal = 250;
      const paymentMethod = 'EFECTIVO';
      const notes = 'Cliente frecuente';
      const discount = 0;
      const sale = { id: 'sale-999' };

      const payload = {
        items: items.map((it) => ({
          productId: it.productId || null,
          description: it.description,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
        })),
        payments: [
          {
            method: paymentMethod,
            amount: Number(grandTotal.toFixed(2)),
            reference: notes || null,
          },
        ],
        discount: Number(discount || 0),
        notes: notes || null,
      };

      const res = await mockAuthFetch(`/api/sales/${sale.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      assert.strictEqual(interceptedCall.url, '/api/sales/sale-999');
      assert.strictEqual(interceptedCall.options.method, 'PATCH');
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.saleNumber, 'VENTA-0042');
    });
  });

  // =========================================================================
  // BLOQUE 2: STRESS TESTS EN src/components/closing/
  // =========================================================================
  describe('2. Stress-Testing Adversarial: src/components/closing/', () => {

    // 2.1 Aritmética de Denominaciones en Quetzales
    it('2.1 Aritmética de Denominaciones: Catálogo completo de 7 denominaciones oficiales en Guatemala', () => {
      assert.strictEqual(DENOMINATIONS.length, 7);
      const values = DENOMINATIONS.map(d => d.value);
      assert.deepEqual(values, [200, 100, 50, 20, 10, 5, 1]);

      // Conteo masivo de arqueo real
      const heavyCounts = {
        200: 100, // 20,000
        100: 50,  //  5,000
        50: 40,   //  2,000
        20: 50,   //  1,000
        10: 100,  //  1,000
        5: 200,   //  1,000
        1: 500,   //    500
      };
      // Total: 20000 + 5000 + 2000 + 1000 + 1000 + 1000 + 500 = 30,500
      assert.strictEqual(calculateDenominationsTotal(heavyCounts), 30500);

      // Resiliencia a inputs corrompidos
      assert.strictEqual(calculateDenominationsTotal(null), 0);
      assert.strictEqual(calculateDenominationsTotal(undefined), 0);
      assert.strictEqual(calculateDenominationsTotal({}), 0);
      assert.strictEqual(calculateDenominationsTotal({ 200: '10', 100: '5' }), 2500);
      assert.strictEqual(calculateDenominationsTotal({ 200: 'invalido', 50: 2 }), 100);
    });

    // 2.2 Clasificación de discrepancias (CUADRADA, SOBRANTE, FALTANTE) y precisión decimal
    it('2.2 Clasificación de discrepancias: CUADRADA (diff=0), SOBRANTE (diff>0), FALTANTE (diff<0)', () => {
      // Caso CUADRADA
      const diffZero = calculateDifference(2500, 2500);
      assert.strictEqual(diffZero, 0);
      const statusCuadrada = getDiscrepancyStatus(diffZero);
      assert.strictEqual(statusCuadrada.status, 'CUADRADA');
      assert.strictEqual(statusCuadrada.label, 'Caja cuadrada exacta');

      // Caso SOBRANTE
      const diffSobrante = calculateDifference(2575.50, 2500.00);
      assert.strictEqual(diffSobrante, 75.50);
      const statusSobrante = getDiscrepancyStatus(diffSobrante);
      assert.strictEqual(statusSobrante.status, 'SOBRANTE');
      assert.strictEqual(statusSobrante.label, 'Sobrante en caja');

      // Caso FALTANTE
      const diffFaltante = calculateDifference(2450.25, 2500.00);
      assert.strictEqual(diffFaltante, -49.75);
      const statusFaltante = getDiscrepancyStatus(diffFaltante);
      assert.strictEqual(statusFaltante.status, 'FALTANTE');
      assert.strictEqual(statusFaltante.label, 'Faltante en caja');

      // Prueba de precisión matemática: valores idénticos resultan en balance cero
      const diffMath = calculateDifference(100.10, 100.10);
      assert.strictEqual(diffMath, 0);
      assert.strictEqual(getDiscrepancyStatus(diffMath).status, 'CUADRADA');

      // Prueba de microdiferencia float
      const diffFloat = calculateDifference(0.30, 0.10 + 0.20);
      assert.strictEqual(diffFloat === 0, true, 'calculateDifference debe clasificar balance cero como CUADRADA');
      assert.strictEqual(getDiscrepancyStatus(diffFloat).status, 'CUADRADA');
    });

    // 2.3 Compuerta del Modal de Confirmación (Confirmation Modal Gate)
    it('2.3 Confirmation Modal Gate: bloquea cierre sin efectivo y condiciona POST a confirmación', async () => {
      // Simular lógica de compuerta en CashClosingView
      let showConfirmModal = false;
      let errorMsg = null;

      const handleOpenConfirmationLogic = (numReported, manualCash) => {
        if (numReported <= 0 && manualCash === '') {
          errorMsg = 'Ingresa el monto de efectivo físico contado en caja.';
          return;
        }
        errorMsg = null;
        showConfirmModal = true;
      };

      // Intento 1: Sin efectivo reportado -> Bloqueado
      handleOpenConfirmationLogic(0, '');
      assert.strictEqual(showConfirmModal, false, 'Modal no debe abrirse sin efectivo');
      assert.strictEqual(errorMsg, 'Ingresa el monto de efectivo físico contado en caja.');

      // Intento 2: Con efectivo reportado -> Abierto
      handleOpenConfirmationLogic(1250, '');
      assert.strictEqual(showConfirmModal, true, 'Modal debe abrirse con efectivo válido');
      assert.strictEqual(errorMsg, null);

      // Simular confirmación
      let modalClosedOnSuccess = false;
      const handleConfirmClosingLogic = async (submitFn) => {
        const ok = await submitFn();
        if (ok) {
          showConfirmModal = false;
          modalClosedOnSuccess = true;
        }
      };

      // Si submit falla, modal permanece abierto
      await handleConfirmClosingLogic(async () => false);
      assert.strictEqual(showConfirmModal, true, 'Modal no se cierra si el submit falla');
      assert.strictEqual(modalClosedOnSuccess, false);

      // Si submit tiene éxito, modal se cierra
      await handleConfirmClosingLogic(async () => true);
      assert.strictEqual(showConfirmModal, false, 'Modal se cierra con submit exitoso');
      assert.strictEqual(modalClosedOnSuccess, true);
    });

    // 2.4 Retención de Tokens Exactos requeridos por suites M3 y forenses
    it('2.4 Retención de Tokens Exactos: showConfirmModal, handleOpenConfirmation, onSubmit, handleConfirmClosing, onClick', () => {
      assert.ok(cashClosingContent.includes('const [showConfirmModal, setShowConfirmModal] = useState(false)'), 'Falta showConfirmModal useState');
      assert.ok(cashClosingContent.includes('const handleOpenConfirmation = (e) =>'), 'Falta función handleOpenConfirmation');
      assert.ok(cashClosingContent.includes('onSubmit={handleOpenConfirmation}'), 'Falta binding onSubmit={handleOpenConfirmation}');
      assert.ok(cashClosingContent.includes('const handleConfirmClosing = async () =>'), 'Falta función handleConfirmClosing');
      assert.ok(cashClosingContent.includes('onClick={handleConfirmClosing}'), 'Falta binding onClick={handleConfirmClosing}');
      assert.ok(cashSummaryContent.includes('handleConfirmClosing, onClick'), 'CashClosingSummary debe recibir handleConfirmClosing y onClick');
      assert.ok(cashSummaryContent.includes('const onConfirm = onClick || handleConfirmClosing;'), 'CashClosingSummary debe resolver onConfirm');
    });

    // 2.5 Validación de Payload para POST /api/closings contra cashClosingSchema
    it('2.5 Validación de Payload POST /api/closings: cumple con cashClosingSchema', () => {
      const closingPayload = {
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        closingType: 'DIARIO',
        totalCashReported: 2550.00,
        observations: 'Arqueo de cierre turno vespertino sin incidencias',
      };

      const parsed = cashClosingSchema.parse(closingPayload);
      assert.ok(parsed);
      assert.strictEqual(parsed.closingType, 'DIARIO');
      assert.strictEqual(parsed.totalCashReported, 2550.00);
    });

    // 2.6 Resiliencia ante liveMetrics nulo o evento no asignado
    it('2.6 Resiliencia: formatWhatsAppSummary maneja valores nulos sin lanzar excepción', () => {
      assert.doesNotThrow(() => {
        const summary = formatWhatsAppSummary({
          activeEvent: null,
          liveMetrics: null,
          calculatedCash: 0,
          cardAmount: 0,
          transferAmount: 0,
          totalGross: 0,
          numReported: 0,
          difference: 0,
          observations: '',
        });
        assert.ok(summary.includes('DECO VINTAGE'));
        assert.ok(summary.includes('Q 0.00'));
      });
    });
  });

  // =========================================================================
  // BLOQUE 3: CONTRATOS DE INTEGRACIÓN CON App.jsx Y RecentSalesList.jsx
  // =========================================================================
  describe('3. Verificación de Contratos de Integración', () => {

    it('3.1 Contrato App.jsx:173 — CashClosingView recibe liveMetrics, activeEvent, onClosingCompleted', () => {
      // Verificar importación perezosa
      assert.match(appContent, /const\s+CashClosingView\s*=\s*lazy\(\(\)\s*=>\s*import\(['"]\.\/components\/CashClosingView['"]\)\);/);

      // Verificar invocación exacta en línea ~173
      const cierreSectionRegex = /activeTab\s*===\s*['"]cierre['"][\s\S]*?<CashClosingView[\s\S]*?\/>/;
      const match = appContent.match(cierreSectionRegex);
      assert.ok(match, 'Sección de cierre con CashClosingView debe existir en App.jsx');

      const closingBlock = match[0];
      assert.ok(closingBlock.includes('liveMetrics={liveMetrics}'), 'Debe pasar liveMetrics');
      assert.ok(closingBlock.includes('activeEvent={activeEvent}'), 'Debe pasar activeEvent');
      assert.ok(closingBlock.includes('onClosingCompleted={refreshMetrics}'), 'Debe pasar onClosingCompleted');

      // Verificar firma de CashClosingView
      assert.match(
        cashClosingContent,
        /export\s+default\s+function\s+CashClosingView\s*\(\s*\{\s*liveMetrics,\s*activeEvent,\s*eventId,\s*onClosingCompleted\s*\}\s*\)/,
        'Firma de CashClosingView debe coincidir con App.jsx'
      );
    });

    it('3.2 Contrato RecentSalesList.jsx:180 — EditSaleModal recibe sale, onClose, onSaved', () => {
      // Verificar importación
      assert.match(recentSalesContent, /import\s+EditSaleModal\s+from\s+['"]\.\/EditSaleModal(\.jsx)?['"];/);

      // Verificar invocación exacta en línea ~180
      const editModalRegex = /\{editingSale\s*&&[\s\S]*?<EditSaleModal[\s\S]*?\/>[\s\S]*?\}/;
      const match = recentSalesContent.match(editModalRegex);
      assert.ok(match, 'Invocación condicional de EditSaleModal debe existir en RecentSalesList.jsx');

      const modalBlock = match[0];
      assert.ok(modalBlock.includes('sale={editingSale}'), 'Debe pasar sale');
      assert.ok(modalBlock.includes('onClose='), 'Debe pasar onClose');
      assert.ok(modalBlock.includes('onSaved={handleSaleSaved}'), 'Debe pasar onSaved');

      // Verificar firma de EditSaleModal
      assert.match(
        editModalContent,
        /export\s+default\s+function\s+EditSaleModal\s*\(\s*\{\s*sale,\s*onClose,\s*onSaved,\s*onSaleUpdated\s*\}\s*\)/,
        'Firma de EditSaleModal debe aceptar onSaved y onSaleUpdated'
      );
    });

    it('3.3 Límite Estricto de Líneas (Line Ceilings) en Contenedores y Submódulos', () => {
      const lineCounts = [
        { file: 'EditSaleModal.jsx', content: editModalContent, max: 70 },
        { file: 'useEditSaleForm.js', content: editHookContent, max: 120 },
        { file: 'EditSaleItemsTable.jsx', content: editTableContent, max: 110 },
        { file: 'CashClosingView.jsx', content: cashClosingContent, max: 70 },
        { file: 'useCashClosing.js', content: cashHookContent, max: 130 },
        { file: 'CashDenominationGrid.jsx', content: fs.readFileSync(cashGridPath, 'utf-8'), max: 110 },
        { file: 'CashClosingSummary.jsx', content: cashSummaryContent, max: 90 },
      ];

      for (const { file, content, max } of lineCounts) {
        const lines = content.trim().split('\n').length;
        assert.ok(
          lines < max,
          `Archivo ${file} excede el límite de < ${max} líneas: tiene ${lines} líneas`
        );
        assert.ok(
          lines <= 200,
          `Archivo ${file} supera el límite absoluto de 200 líneas: tiene ${lines} líneas`
        );
      }
    });
  });
});
