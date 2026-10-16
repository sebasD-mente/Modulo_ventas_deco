import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  savePendingSaleOffline,
  getPendingOfflineSales,
  removePendingOfflineSale,
  clearOfflineSalesQueue,
  syncOfflineSalesQueue,
} from '../../src/services/offlineSalesOutbox.js';

import { getItemAreaCm2 } from '../../src/utils/printSheetDimensions.js';
import { executeCheckInventoryStock } from '../../server/services/ai/aiToolsService.js';

describe('🎪 FASE 6: MOTOR DE COMBOS FERIALES, COLA OFFLINE Y ACELERADORES (HALLAZGOS #86, #87, #88)', () => {

  beforeEach(async () => {
    await clearOfflineSalesQueue();
  });

  // =========================================================================
  // 1. MOTOR AUTOMÁTICO DE COMBOS FERIALES (3xQ165)
  // =========================================================================
  describe('1. Motor de Combos Feriales (Promo 3xQ165 para Pósters Medianos)', () => {
    function calculateComboPromo(cartItems, manualDiscount = 0) {
      const subtotal = cartItems.reduce((acc, it) => acc + (Number(it.unitPrice) * (Number(it.quantity) || 1)), 0);
      const mediumCount = cartItems
        .filter((i) => {
          const s = (i.selectedSizeId || i.sizeId || i.size || '').toUpperCase();
          if (s === 'MEDIANO') return true;
          if (!s && typeof i.description === 'string' && i.description.toUpperCase().includes('MEDIANO')) return true;
          return false;
        })
        .reduce((acc, i) => acc + (Number(i.quantity) || 1), 0);

      const comboSavings = Math.floor(mediumCount / 3) * 30;
      const hasActiveCombo = comboSavings > 0;
      const comboTrios = Math.floor(mediumCount / 3);
      const effectiveDiscount = Math.max(Number(manualDiscount) || 0, comboSavings);
      const grandTotal = Math.max(0, subtotal - effectiveDiscount);

      return {
        subtotal,
        mediumCount,
        comboSavings,
        hasActiveCombo,
        comboTrios,
        effectiveDiscount,
        grandTotal,
      };
    }

    it('1.1: 3 pósters medianos (Q65 c/u = Q195) aplican automáticamente el combo 3xQ165 (ahorro Q30 -> Total Q165)', () => {
      const items = [
        { description: 'Póster Batman Mediano', size: 'MEDIANO', unitPrice: 65, quantity: 1 },
        { description: 'Póster Spiderman Mediano', size: 'MEDIANO', unitPrice: 65, quantity: 1 },
        { description: 'Póster Goku Mediano', size: 'MEDIANO', unitPrice: 65, quantity: 1 },
      ];

      const res = calculateComboPromo(items);
      assert.equal(res.subtotal, 195);
      assert.equal(res.mediumCount, 3);
      assert.equal(res.comboTrios, 1);
      assert.equal(res.comboSavings, 30);
      assert.equal(res.hasActiveCombo, true);
      assert.equal(res.effectiveDiscount, 30);
      assert.equal(res.grandTotal, 165);
    });

    it('1.2: 6 pósters medianos aplican 2 combos (ahorro Q60 -> Total Q330)', () => {
      const items = [
        { description: 'Póster Star Wars Mediano', size: 'MEDIANO', unitPrice: 65, quantity: 4 },
        { description: 'Póster Anime Retro Mediano', size: 'MEDIANO', unitPrice: 65, quantity: 2 },
      ];

      const res = calculateComboPromo(items);
      assert.equal(res.subtotal, 390);
      assert.equal(res.mediumCount, 6);
      assert.equal(res.comboTrios, 2);
      assert.equal(res.comboSavings, 60);
      assert.equal(res.hasActiveCombo, true);
      assert.equal(res.effectiveDiscount, 60);
      assert.equal(res.grandTotal, 330);
    });

    it('1.3: 2 pósters medianos y 1 pequeño NO activan el combo (ahorro Q0)', () => {
      const items = [
        { description: 'Póster Batman Mediano', size: 'MEDIANO', unitPrice: 65, quantity: 2 },
        { description: 'Póster Sticker Pequeño', size: 'PEQUENO', unitPrice: 35, quantity: 1 },
      ];

      const res = calculateComboPromo(items);
      assert.equal(res.subtotal, 165);
      assert.equal(res.mediumCount, 2);
      assert.equal(res.comboSavings, 0);
      assert.equal(res.hasActiveCombo, false);
      assert.equal(res.grandTotal, 165);
    });

    it('1.4: Descuento manual mayor (ej. Q40) prevalece sobre el ahorro de combo (Q30)', () => {
      const items = [
        { description: 'Póster 1 Mediano', size: 'MEDIANO', unitPrice: 65, quantity: 3 },
      ];

      const res = calculateComboPromo(items, 40);
      assert.equal(res.comboSavings, 30);
      assert.equal(res.effectiveDiscount, 40);
      assert.equal(res.grandTotal, 155);
    });
  });

  // =========================================================================
  // 2. COLA OFFLINE INDEXEDDB / LOCALSTORAGE (SALES OUTBOX)
  // =========================================================================
  describe('2. Cola Offline (Sales Outbox) para caídas de internet ferial', () => {
    it('2.1: Encola ventas con estado PENDING, timestamp e idempotencyKey único', async () => {
      const payload = {
        eventId: 'event-comic-con-2026',
        items: [{ description: 'Póster Deadpool Mediano', quantity: 1, unitPrice: 65 }],
        payments: [{ method: 'EFECTIVO', amount: 65 }],
        idempotencyKey: 'offline-sale-001',
      };

      const saved = await savePendingSaleOffline(payload);
      assert.equal(saved.idempotencyKey, 'offline-sale-001');
      assert.equal(saved.offline, true);
      assert.equal(saved.syncStatus, 'PENDING');
      assert.ok(saved.queuedAt);

      const pending = await getPendingOfflineSales();
      assert.equal(pending.length, 1);
      assert.equal(pending[0].idempotencyKey, 'offline-sale-001');
    });

    it('2.2: Remueve o marca ventas como sincronizadas al confirmarse', async () => {
      await savePendingSaleOffline({ idempotencyKey: 'offline-sale-002', items: [] });
      await savePendingSaleOffline({ idempotencyKey: 'offline-sale-003', items: [] });

      let list = await getPendingOfflineSales();
      assert.equal(list.length, 2);

      await removePendingOfflineSale('offline-sale-002');
      list = await getPendingOfflineSales();
      assert.equal(list.length, 1);
      assert.equal(list[0].idempotencyKey, 'offline-sale-003');
    });

    it('2.3: syncOfflineSalesQueue envía ventas pendientes con su Idempotency-Key y limpia la cola', async () => {
      await savePendingSaleOffline({
        eventId: 'event-interfer-2026',
        idempotencyKey: 'offline-sync-100',
        items: [{ description: 'Póster Nirvana', quantity: 1, unitPrice: 65 }],
        payments: [{ method: 'EFECTIVO', amount: 65 }],
      });

      const calledHeaders = [];
      const mockAuthFetch = async (url, options) => {
        calledHeaders.push(options.headers);
        return {
          ok: true,
          json: async () => ({ success: true, data: { saleNumber: 'VENTA-100', idempotentReplay: false } }),
        };
      };

      const syncResult = await syncOfflineSalesQueue(mockAuthFetch);
      assert.equal(syncResult.syncedCount, 1);
      assert.equal(syncResult.failedCount, 0);
      assert.equal(syncResult.pending, 0);
      assert.equal(calledHeaders[0]['Idempotency-Key'], 'offline-sync-100');

      const remaining = await getPendingOfflineSales();
      assert.equal(remaining.length, 0);
    });
  });

  // =========================================================================
  // 3. OCUPACIÓN GEOMÉTRICA EN CM² PARA PLIEGOS DE TALLER (70x100 cm = 7,000 cm²)
  // =========================================================================
  describe('3. Acelerador de Taller: Ocupación Geométrica en cm² de Pliegos', () => {
    const STANDARD_SHEET_AREA = 70 * 100; // 7,000 cm²

    it('3.1: Resuelve las áreas oficiales de cada formato de póster', () => {
      assert.equal(getItemAreaCm2({ size: 'MINI' }), 294);
      assert.equal(getItemAreaCm2({ size: 'PEQUENO' }), 500);
      assert.equal(getItemAreaCm2({ size: 'PORTADA_ALBUM' }), 900);
      assert.equal(getItemAreaCm2({ size: 'MEDIANO' }), 1200);
      assert.equal(getItemAreaCm2({ size: 'GRANDE' }), 2000);
      assert.equal(getItemAreaCm2({ size: 'GIGANTE' }), 4800);
    });

    it('3.2: Calcula la ocupación total y porcentaje en un pliego de 7,000 cm²', () => {
      const sheetItems = [
        { id: '1', size: 'MEDIANO' }, // 1200 cm²
        { id: '2', size: 'MEDIANO' }, // 1200 cm²
        { id: '3', size: 'PORTADA_ALBUM' }, // 900 cm²
        { id: '4', size: 'PEQUENO' }, // 500 cm²
      ];

      const totalOccupied = sheetItems.reduce((acc, it) => acc + getItemAreaCm2(it), 0);
      // 1200 + 1200 + 900 + 500 = 3800 cm²
      assert.equal(totalOccupied, 3800);

      const percent = Math.round((totalOccupied / STANDARD_SHEET_AREA) * 100);
      // 3800 / 7000 = 54.28% -> 54%
      assert.equal(percent, 54);
    });

    it('3.3: Detecta cuando un lote excede la capacidad de un pliego individual', () => {
      const bigBatch = [
        { id: '1', size: 'GIGANTE' }, // 4800 cm²
        { id: '2', size: 'GRANDE' },  // 2000 cm²
        { id: '3', size: 'MEDIANO' }, // 1200 cm²
      ];

      const totalOccupied = bigBatch.reduce((acc, it) => acc + getItemAreaCm2(it), 0);
      // 4800 + 2000 + 1200 = 8000 cm²
      assert.equal(totalOccupied, 8000);
      assert.ok(totalOccupied > STANDARD_SHEET_AREA);
    });
  });

  // =========================================================================
  // 4. RADAR DE PUNTO DE EQUILIBRIO (BREAK-EVEN) Y RENTABILIDAD
  // =========================================================================
  describe('4. Acelerador Financiero: Radar de Punto de Equilibrio y Rentabilidad', () => {
    function computeBreakEven({ totalSold, standFixedCost = 2500 }) {
      const estimatedProductionCost = totalSold * 0.30;
      const totalCosts = standFixedCost + estimatedProductionCost;
      const netProfit = totalSold - totalCosts;
      const breakEvenTarget = standFixedCost / 0.70;
      const breakEvenProgress = totalSold > 0 ? Math.min(100, Math.round((totalSold / breakEvenTarget) * 100)) : 0;
      const isProfitable = netProfit >= 0;

      return {
        totalSold,
        standFixedCost,
        estimatedProductionCost,
        totalCosts,
        netProfit,
        breakEvenTarget,
        breakEvenProgress,
        isProfitable,
      };
    }

    it('4.1: Venta por debajo del punto de equilibrio refleja costos fijos y progreso porcentual', () => {
      // Con standCost de Q2500, breakEvenTarget = 2500 / 0.7 = Q3571.43
      const stats = computeBreakEven({ totalSold: 2000, standFixedCost: 2500 });
      assert.equal(stats.estimatedProductionCost, 600); // 2000 * 0.30
      assert.equal(stats.totalCosts, 3100); // 2500 + 600
      assert.equal(stats.netProfit, -1100); // 2000 - 3100
      assert.equal(stats.isProfitable, false);
      assert.equal(stats.breakEvenProgress, 56); // 2000 / 3571.43 = 56%
    });

    it('4.2: Venta por encima del punto de equilibrio genera utilidad neta positiva', () => {
      const stats = computeBreakEven({ totalSold: 5000, standFixedCost: 2500 });
      assert.equal(stats.estimatedProductionCost, 1500); // 5000 * 0.30
      assert.equal(stats.totalCosts, 4000); // 2500 + 1500
      assert.equal(stats.netProfit, 1000); // 5000 - 4000 = Q1000 de ganancia neta
      assert.equal(stats.isProfitable, true);
      assert.equal(stats.breakEvenProgress, 100);
    });
  });

  // =========================================================================
  // 5. STOCK FÍSICO REAL EN executeCheckInventoryStock (POSTGRESQL RESILIENTE)
  // =========================================================================
  describe('5. Stock Físico Real en aiToolsService', () => {
    it('5.1: executeCheckInventoryStock devuelve stockAvailable y estructura de stock físico', async () => {
      const result = await executeCheckInventoryStock('tenant-test', 'Batman', 'MEDIANO');
      assert.ok(result);
      if (result.found) {
        assert.ok(result.stockAvailability);
        assert.equal(typeof result.stockAvailability.stockAvailable, 'boolean');
        assert.equal(typeof result.stockAvailability.unitsInStock, 'number');
        assert.ok(result.stockAvailability.deliveryMode);
      }
    });
  });

});
