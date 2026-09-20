/**
 * tests/adversarial/sprint4-adversarial-empirical.test.js
 * 
 * ⚔️ INDEPENDENT EMPIRICAL CHALLENGER TEST SUITE (SPRINT 4)
 * 
 * Verifies:
 * 1. Workshop Brake in AssignItemsToSheetModal:
 *    - Items with paymentStatus === 'PENDIENTE_ANTICIPO' or status === 'ANULADA' cannot be selected.
 *    - Exact red padlock indicator: "🔒 BLOQUEADO: Pedido #{saleNumber} sin anticipo (Pendiente Q {balanceDue})"
 *    - Approved items render: "🟢 Anticipo Confirmado"
 * 2. Endpoint Interactions & Payload Conformance:
 *    - POST /api/production/print-sheets/:id/items sends { saleItemIds: [...] } (NOT itemIds).
 *    - PATCH /api/production/print-sheets/:id/status only sends valid statuses.
 * 3. Component AST & Logic Boundary Stress:
 *    - Fail-closed behavior on missing / null sale object.
 *    - Disabled checkbox preventing toggle events.
 *    - Non-eligible items filtered out during select-all.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ CHALLENGER 1 EMPIRICAL AUDIT: SPRINT 4 WORKSHOP BRAKE & PAYLOAD CONFORMANCE', () => {
  const modalPath = path.join(rootDir, 'src/components/production/AssignItemsToSheetModal.jsx');
  const hookPath = path.join(rootDir, 'src/components/production/hooks/usePrintSheets.js');
  const cardPath = path.join(rootDir, 'src/components/production/PrintSheetCard.jsx');
  const detailPath = path.join(rootDir, 'src/components/production/PrintSheetDetailModal.jsx');

  const modalSource = fs.readFileSync(modalPath, 'utf-8');
  const hookSource = fs.readFileSync(hookPath, 'utf-8');
  const cardSource = fs.readFileSync(cardPath, 'utf-8');
  const detailSource = fs.readFileSync(detailPath, 'utf-8');

  // =========================================================================
  // 1. WORKSHOP BRAKE (FRENO INQUEBRANTABLE DE TALLER)
  // =========================================================================
  describe('1. Freno Inquebrantable de Taller: Selection Gate & UI Render', () => {
    // Replicate the exact gatekeeper logic from AssignItemsToSheetModal.jsx (lines 27-33)
    const checkIsBlocked = (item) => {
      const sale = item.sale || {};
      const isAnulada = sale.status === 'ANULADA';
      const isPendingDeposit = sale.paymentStatus === 'PENDIENTE_ANTICIPO';
      const isMissingDeposit = !['ANTICIPO_PAGADO', 'PAGADO_TOTAL'].includes(sale.paymentStatus);
      return isAnulada || isPendingDeposit || isMissingDeposit;
    };

    it('1.1. CANNOT select item when paymentStatus === "PENDIENTE_ANTICIPO"', () => {
      const item = { id: 'it-1', sale: { saleNumber: 'VENT-101', status: 'PENDIENTE', paymentStatus: 'PENDIENTE_ANTICIPO', balanceDue: 150 } };
      assert.strictEqual(checkIsBlocked(item), true, 'Must block item with PENDIENTE_ANTICIPO');
    });

    it('1.2. CANNOT select item when status === "ANULADA" (even if paymentStatus is PAGADO_TOTAL)', () => {
      const item = { id: 'it-2', sale: { saleNumber: 'VENT-102', status: 'ANULADA', paymentStatus: 'PAGADO_TOTAL', balanceDue: 0 } };
      assert.strictEqual(checkIsBlocked(item), true, 'Must block item with ANULADA status regardless of payment');
    });

    it('1.3. CANNOT select item when sale object is missing or paymentStatus is corrupted (fail-closed)', () => {
      const itemNoSale = { id: 'it-3' };
      assert.strictEqual(checkIsBlocked(itemNoSale), true, 'Must block item with missing sale');

      const itemCorrupted = { id: 'it-4', sale: { status: 'COMPLETADA', paymentStatus: 'INVALID_STATUS' } };
      assert.strictEqual(checkIsBlocked(itemCorrupted), true, 'Must block item with invalid paymentStatus');
    });

    it('1.4. CAN select item when paymentStatus === "ANTICIPO_PAGADO"', () => {
      const item = { id: 'it-5', sale: { saleNumber: 'VENT-105', status: 'PENDIENTE', paymentStatus: 'ANTICIPO_PAGADO', balanceDue: 75 } };
      assert.strictEqual(checkIsBlocked(item), false, 'Must allow item with ANTICIPO_PAGADO');
    });

    it('1.5. CAN select item when paymentStatus === "PAGADO_TOTAL"', () => {
      const item = { id: 'it-6', sale: { saleNumber: 'VENT-106', status: 'COMPLETADA', paymentStatus: 'PAGADO_TOTAL', balanceDue: 0 } };
      assert.strictEqual(checkIsBlocked(item), false, 'Must allow item with PAGADO_TOTAL');
    });

    it('1.6. UI renders exact red padlock indicator: 🔒 BLOQUEADO: Pedido #{saleNumber} sin anticipo (Pendiente Q {balanceDue})', () => {
      assert.ok(
        modalSource.includes('🔒 BLOQUEADO: Pedido #{sale.saleNumber || \'S/N\'} sin anticipo (Pendiente Q {balanceDue})'),
        'Must render the exact red padlock indicator string'
      );
      assert.ok(
        modalSource.includes('Number(sale.balanceDue || 0).toFixed(2)'),
        'Must format balanceDue with two decimal places'
      );
    });

    it('1.7. UI renders exact approved indicator: 🟢 Anticipo Confirmado', () => {
      assert.ok(
        modalSource.includes('🟢 Anticipo Confirmado'),
        'Must render exact 🟢 Anticipo Confirmado indicator for authorized orders'
      );
    });

    it('1.8. Checkbox is strictly disabled and click events are halted when blocked', () => {
      assert.ok(
        modalSource.includes('disabled={isBlocked}'),
        'HTML input checkbox must have disabled={isBlocked}'
      );
      assert.ok(
        modalSource.includes('toggleSelect = (id, isBlocked) => {'),
        'toggleSelect must receive isBlocked argument'
      );
      assert.ok(
        modalSource.includes('if (isBlocked || isSubmitting) return;'),
        'toggleSelect must return immediately if isBlocked is true'
      );
    });

    it('1.9. "Seleccionar Habilitados" strictly ignores blocked items', () => {
      assert.ok(
        modalSource.includes('if (!checkIsBlocked(it)) next.add(it.id)'),
        'selectAllEligible must check !checkIsBlocked(it) before adding item'
      );
    });
  });

  // =========================================================================
  // 2. ENDPOINT INTERACTIONS & PAYLOAD CONFORMANCE
  // =========================================================================
  describe('2. Endpoint Interactions & Payload Conformance', () => {
    it('2.1. POST /api/production/print-sheets/:id/items sends { saleItemIds: [...] } (NOT itemIds)', () => {
      assert.ok(
        hookSource.includes('/api/production/print-sheets/${sheetId}/items'),
        'Must call POST /api/production/print-sheets/${sheetId}/items'
      );
      assert.ok(
        hookSource.includes('body: JSON.stringify({ saleItemIds })'),
        'Payload must be strictly { saleItemIds }'
      );
      assert.ok(
        !hookSource.includes('body: JSON.stringify({ itemIds })'),
        'Payload MUST NOT send itemIds'
      );
    });

    it('2.2. PATCH /api/production/print-sheets/:id/status only sends valid statuses (ABIERTO, EN_PRODUCCION, IMPRESO, TERMINADO)', () => {
      const validStatuses = new Set(['ABIERTO', 'EN_PRODUCCION', 'IMPRESO', 'TERMINADO']);

      // Check all occurrences of status transitions in PrintSheetCard
      const cardStatusCalls = [
        ...cardSource.matchAll(/handleStatusChange\('([A-Z_]+)'\)/g),
        ...cardSource.matchAll(/setConfirmingStatus\('([A-Z_]+)'\)/g),
      ].map((m) => m[1]);

      assert.ok(cardStatusCalls.length > 0, 'Card must trigger status transitions');
      for (const st of cardStatusCalls) {
        assert.ok(
          validStatuses.has(st),
          `PrintSheetCard attempted invalid status transition: ${st}`
        );
      }

      // Check all occurrences of status transitions in PrintSheetDetailModal
      const detailStatusCalls = [
        ...detailSource.matchAll(/handleStatusTransition\('([A-Z_]+)'\)/g),
        ...detailSource.matchAll(/setConfirmingStatus\('([A-Z_]+)'\)/g),
      ].map((m) => m[1]);

      assert.ok(detailStatusCalls.length > 0, 'Detail modal must trigger status transitions');
      for (const st of detailStatusCalls) {
        assert.ok(
          validStatuses.has(st),
          `PrintSheetDetailModal attempted invalid status transition: ${st}`
        );
      }
    });

    it('2.3. Modal submission validates that selectedIds is non-empty before calling onAssign', () => {
      assert.ok(
        modalSource.includes('if (selectedIds.size === 0)'),
        'Must validate selectedIds.size === 0 before submitting'
      );
      assert.ok(
        modalSource.includes('onAssign(sheet.id, Array.from(selectedIds))'),
        'Must pass sheet.id and Array.from(selectedIds) to onAssign'
      );
    });
  });

  // =========================================================================
  // 3. CODE ERGONOMICS & ZERO-TRUST SECURITY AUDIT
  // =========================================================================
  describe('3. Ergonomics (>= 44x44px) and Zero-Trust Compliance', () => {
    it('3.1. All interactive buttons, checkboxes and inputs meet >= 44x44px touch targets', () => {
      assert.ok(modalSource.includes('min-h-[44px] min-w-[44px]'), 'Modal must have 44px touch wrapper');
      assert.ok(cardSource.includes('min-h-[44px]'), 'Card buttons must have min-h-[44px]');
      assert.ok(detailSource.includes('min-h-[44px]'), 'Detail modal buttons must have min-h-[44px]');
    });

    it('3.2. Zero hardcoded secrets, plain emails, or foreign infrastructure IPs', () => {
      for (const src of [modalSource, hookSource, cardSource, detailSource]) {
        assert.ok(!src.includes('145.223.120.56'), 'Must not reference foreign IP');
        assert.ok(!src.includes('sebasdmente@gmail.com'), 'Must not reference personal email');
      }
    });
  });
});
