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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('🛡️ SUITE MODULAR DE ARQUEO DE CAJA: CashClosingView & Submódulos (Phase 5)', () => {

  // =========================================================================
  // 1. AUDITORÍA ESTRICTA DE LÍMITES DE LÍNEAS (LINE CEILINGS)
  // =========================================================================
  describe('1. Cumplimiento Estricto de Límites de Líneas y Erradicación de Monolitos', () => {
    const fileCeilings = [
      { file: 'src/components/CashClosingView.jsx', max: 70, desc: 'Contenedor Maestro Canónico' },
      { file: 'src/components/closing/hooks/useCashClosing.js', max: 130, desc: 'Hook y Lógica de Arqueo' },
      { file: 'src/components/closing/CashDenominationGrid.jsx', max: 110, desc: 'Rejilla Visual de Denominaciones' },
      { file: 'src/components/closing/CashClosingSummary.jsx', max: 90, desc: 'Resumen de Conciliación y Modal' },
    ];

    for (const { file, max, desc } of fileCeilings) {
      it(`1.x. ${file} (${desc}) respeta estrictamente el límite de < ${max} líneas`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `El archivo ${file} debe existir`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lineCount = content.split('\n').length;
        assert.ok(
          lineCount < max,
          `Violación de límite: ${file} tiene ${lineCount} líneas (máximo permitido < ${max})`
        );
        assert.ok(
          lineCount <= 200,
          `Violación de deuda técnica: ${file} supera 200 líneas`
        );
      });
    }
  });

  // =========================================================================
  // 2. AUDITORÍA FORENSE DE CERO MOCKS O STUBS EN PRODUCCIÓN
  // =========================================================================
  describe('2. Auditoría Forense: Cero Mocks, Stubs o Placeholders Residuales', () => {
    const filesToAudit = [
      'src/components/CashClosingView.jsx',
      'src/components/closing/hooks/useCashClosing.js',
      'src/components/closing/CashDenominationGrid.jsx',
      'src/components/closing/CashClosingSummary.jsx',
    ];

    it('2.1. Ningún archivo contiene TODO, FIXME, STUB, MOCK o marcadores dummy', () => {
      const suspiciousPattern = /(\/\/\s*(TODO|FIXME|STUB|MOCK|PLACEHOLDER)|\/\*[\s\S]*?(TODO|FIXME|STUB|MOCK|PLACEHOLDER)[\s\S]*?\*\/|return\s+true;\s*\/\/\s*bypass)/i;
      for (const file of filesToAudit) {
        const fullPath = path.join(rootDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const match = content.match(suspiciousPattern);
        assert.ok(!match, `Detectado marcador sospechoso en ${file}: "${match?.[0]}"`);
      }
    });

    it('2.2. Ningún archivo contiene IPs foráneas ni credenciales expuestas', () => {
      for (const file of filesToAudit) {
        const fullPath = path.join(rootDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        assert.ok(!content.includes('145.223.120.56'), `IP foránea detectada en ${file}`);
        assert.ok(!content.match(/[a-zA-Z0-9._%+-]+@gmail\.com/), `Correo @gmail.com detectado en ${file}`);
      }
    });
  });

  // =========================================================================
  // 3. CONTRATOS ESTÁTICOS Y COMPATIBILIDAD CON SUITES M3
  // =========================================================================
  describe('3. Verificación de Contratos Públicos y Tokens Requeridos por M3', () => {
    const fullPath = path.join(rootDir, 'src/components/CashClosingView.jsx');
    const content = fs.readFileSync(fullPath, 'utf-8');

    it('3.1. CashClosingView.jsx exporta por defecto una función con los 4 props canónicos', () => {
      assert.match(
        content,
        /export\s+default\s+function\s+CashClosingView\s*\(\s*\{\s*liveMetrics,\s*activeEvent,\s*eventId,\s*onClosingCompleted\s*\}\s*\)/
      );
    });

    it('3.2. Retiene el estado showConfirmModal y handlers requeridos por m3-adversarial-frontend', () => {
      assert.match(content, /const \[showConfirmModal,\s*setShowConfirmModal\]\s*=\s*useState\(false\)/);
      assert.match(content, /onSubmit=\{handleOpenConfirmation\}/);
      assert.match(content, /setShowConfirmModal\(true\)/);
      assert.match(content, /onClick=\{handleConfirmClosing\}/);
    });

    it('3.3. Retiene las cadenas exactas auditadas por m3-forensic-audit', () => {
      assert.ok(content.includes('showConfirmModal'), 'Debe incluir showConfirmModal');
      assert.ok(content.includes('handleOpenConfirmation'), 'Debe incluir handleOpenConfirmation');
      assert.ok(content.includes('¿Confirmar Asiento de Cierre?'), 'Debe incluir título de confirmación');
      assert.ok(content.includes('Efectivo Esperado (Sistema):'), 'Debe incluir display efectivo esperado');
      assert.ok(content.includes('Efectivo Físico Contado:'), 'Debe incluir display efectivo contado');
      assert.ok(content.includes('Balance / Diferencia:'), 'Debe incluir display balance');
      assert.ok(content.includes('handleConfirmClosing'), 'Debe incluir handleConfirmClosing');
    });
  });

  // =========================================================================
  // 4. ARITMÉTICA GENUINA DE DENOMINACIONES DE QUETZALES
  // =========================================================================
  describe('4. Aritmética Genuina de Conteo de Denominaciones', () => {
    it('4.1. Catálogo completo de 7 denominaciones oficiales en Guatemala', () => {
      assert.equal(DENOMINATIONS.length, 7);
      const values = DENOMINATIONS.map(d => d.value);
      assert.deepEqual(values, [200, 100, 50, 20, 10, 5, 1]);

      const billDenoms = DENOMINATIONS.filter(d => d.type === 'billete');
      const coinDenoms = DENOMINATIONS.filter(d => d.type === 'moneda');
      assert.equal(billDenoms.length, 6);
      assert.equal(coinDenoms.length, 1);
      assert.equal(coinDenoms[0].value, 1);
    });

    it('4.2. Conteo vacío o inicial retorna Q 0.00', () => {
      assert.equal(calculateDenominationsTotal(INITIAL_COUNTS), 0);
      assert.equal(calculateDenominationsTotal({}), 0);
      assert.equal(calculateDenominationsTotal(null), 0);
    });

    it('4.3. Desglose mixto completo calcula con total exactitud', () => {
      const counts = {
        200: 5,   // Q 1,000.00
        100: 10,  // Q 1,000.00
        50: 4,    // Q   200.00
        20: 5,    // Q   100.00
        10: 10,   // Q   100.00
        5: 20,    // Q   100.00
        1: 50,    // Q    50.00
      };
      // Total esperado: 1000 + 1000 + 200 + 100 + 100 + 100 + 50 = 2550
      const total = calculateDenominationsTotal(counts);
      assert.equal(total, 2550);
    });

    it('4.4. Conteo singular por cada denominación individual', () => {
      for (const { value } of DENOMINATIONS) {
        assert.equal(calculateDenominationsTotal({ [value]: 3 }), value * 3);
      }
    });
  });

  // =========================================================================
  // 5. CÁLCULO DE DIFERENCIAS Y CATEGORIZACIÓN DE DISCREPANCIAS
  // =========================================================================
  describe('5. Cálculo de Diferencias y Estados de Arqueo', () => {
    it('5.1. Caja cuadrada exacta (diferencia == 0)', () => {
      const diff = calculateDifference(1500, 1500);
      assert.equal(diff, 0);
      const status = getDiscrepancyStatus(diff);
      assert.equal(status.status, 'CUADRADA');
      assert.equal(status.label, 'Caja cuadrada exacta');
    });

    it('5.2. Sobrante en caja (diferencia > 0)', () => {
      const diff = calculateDifference(1550, 1500);
      assert.equal(diff, 50);
      const status = getDiscrepancyStatus(diff);
      assert.equal(status.status, 'SOBRANTE');
      assert.equal(status.label, 'Sobrante en caja');
    });

    it('5.3. Faltante en caja (diferencia < 0)', () => {
      const diff = calculateDifference(1450, 1500);
      assert.equal(diff, -50);
      const status = getDiscrepancyStatus(diff);
      assert.equal(status.status, 'FALTANTE');
      assert.equal(status.label, 'Faltante en caja');
    });

    it('5.4. Precisión decimal previene artefactos de punto flotante de JavaScript', () => {
      const diff = calculateDifference(100.10, 100.00);
      assert.equal(diff, 0.1);
      assert.notEqual(diff.toString(), '0.10000000000000142');
    });
  });

  // =========================================================================
  // 6. FORMATO DE MENSAJE PARA WHATSAPP Y COMUNICACIÓN API
  // =========================================================================
  describe('6. Plantilla WhatsApp y Contrato con Backend API', () => {
    it('6.1. formatWhatsAppSummary genera resumen estructurado con datos del evento', () => {
      const summary = formatWhatsAppSummary({
        activeEvent: {
          name: 'Comic Con Guatemala',
          location: 'Parque de la Industria',
          tenant: { name: 'DECO VINTAGE' },
        },
        liveMetrics: {
          totalAmount: 3500,
          totalTransactions: 28,
          totalUnits: 45,
          paymentBreakdown: {
            EFECTIVO: { amount: 2000, count: 18 },
            TARJETA: { amount: 1000, count: 7 },
            TRANSFERENCIA: { amount: 500, count: 3 },
          },
        },
        calculatedCash: 2000,
        cardAmount: 1000,
        transferAmount: 500,
        totalGross: 3500,
        numReported: 2000,
        difference: 0,
        observations: 'Turno sin novedades, excelente flujo.',
      });

      assert.ok(summary.includes('Comic Con Guatemala'));
      assert.ok(summary.includes('Parque de la Industria'));
      assert.ok(summary.includes('DECO VINTAGE'));
      assert.ok(summary.includes('Q 3500.00'));
      assert.ok(summary.includes('28 ventas'));
      assert.ok(summary.includes('45 unidades'));
      assert.ok(summary.includes('Cuadrado Exacto ✅'));
      assert.ok(summary.includes('Turno sin novedades, excelente flujo.'));
    });

    it('6.2. useCashClosing.js invoca el endpoint POST /api/closings con la carga requerida', () => {
      const hookPath = path.join(rootDir, 'src/components/closing/hooks/useCashClosing.js');
      const hookContent = fs.readFileSync(hookPath, 'utf-8');
      assert.ok(hookContent.includes("'/api/closings'"));
      assert.ok(hookContent.includes("closingType: 'DIARIO'"));
      assert.ok(hookContent.includes('totalCashReported: numReported'));
      assert.ok(hookContent.includes('observations: observations || null'));
    });
  });
});
