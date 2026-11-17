import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateEventFinancials } from '../../server/services/eventFinanceService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('🏛️ [feat-015] Limpieza de Vista de Eventos e Integración Contextual del Radar Financiero por Evento', () => {
  it('1. EventsManagementView.jsx retira por completo EventFinancialRadar de la vista general', () => {
    const viewCode = fs.readFileSync(path.join(ROOT, 'src/components/EventsManagementView.jsx'), 'utf-8');

    assert.ok(
      !viewCode.includes('EventFinancialRadar'),
      'EventsManagementView.jsx NO debe importar ni montar EventFinancialRadar en la vista general'
    );
    assert.ok(
      !viewCode.includes('./monitor/EventFinancialRadar'),
      'EventsManagementView.jsx NO debe importar ./monitor/EventFinancialRadar'
    );
  });

  it('2. EventsManagementView.jsx muestra primero Ventas en Línea y Redes Sociales seguido de Eventos en curso, Confirmados y Archivados', () => {
    const viewCode = fs.readFileSync(path.join(ROOT, 'src/components/EventsManagementView.jsx'), 'utf-8');

    // Tomamos la rama general (después del bloque exclusivo de VENDEDOR_REDES)
    const adminBranchIdx = viewCode.indexOf('<EventsFilterBar');
    assert.ok(adminBranchIdx > -1, 'Debe renderizar EventsFilterBar en la vista general');

    const adminSection = viewCode.slice(adminBranchIdx);
    const digitalCardIdx = adminSection.indexOf('data-testid="permanent-digital-pos-card"');
    const activeEventsIdx = adminSection.indexOf('Eventos en curso (');
    const confirmedEventsIdx = adminSection.indexOf('Eventos confirmados / Próximos (');
    const archivedEventsIdx = adminSection.indexOf('data-testid="toggle-archived-events-btn"');

    assert.ok(digitalCardIdx > -1, 'Debe incluir la tarjeta fija permanent-digital-pos-card');
    assert.ok(activeEventsIdx > digitalCardIdx, 'Eventos en curso debe aparecer inmediatamente después de la tarjeta fija de Redes Sociales');
    assert.ok(confirmedEventsIdx > activeEventsIdx, 'Eventos confirmados / Próximos debe aparecer después de Eventos en curso');
    assert.ok(archivedEventsIdx > confirmedEventsIdx, 'Eventos Archivados debe aparecer al final después de Confirmados');
  });

  it('3. EventSalesModal.jsx integra el Radar Financiero Ferial completo, gestión de gastos, pagos, cortes y jornadas', () => {
    const modalCode = fs.readFileSync(path.join(ROOT, 'src/components/events/modals/EventSalesModal.jsx'), 'utf-8');
    const viewCode = fs.readFileSync(path.join(ROOT, 'src/components/EventsManagementView.jsx'), 'utf-8');

    // Conexión de evento vivo y gestión de gastos desde EventsManagementView hacia EventSalesModal
    assert.ok(viewCode.includes('activeSalesEvent'), 'EventsManagementView debe resolver activeSalesEvent actualizado desde m.events');
    assert.ok(viewCode.includes('onManageExpenses={'), 'EventsManagementView debe pasar onManageExpenses a EventSalesModal');

    // Integración completa dentro del modal individual de cada evento
    assert.ok(modalCode.includes('data-testid="event-modal-financial-radar"'), 'Debe renderizar el contenedor del radar contextual');
    assert.ok(modalCode.includes('Radar Financiero Ferial (Regla del 20%)'), 'Debe titular el Radar Financiero Ferial (Regla del 20%)');
    assert.ok(modalCode.includes('data-testid="modal-manage-expenses-btn"'), 'Debe exponer acción directa para gestionar gastos en la cabecera del radar');
    assert.ok(modalCode.includes('Registrar gastos del stand'), 'Debe ofrecer CTA directo cuando el evento aún tiene 0 gastos');

    // Las 4 tarjetas contables, barra 5x, ritmo diario, formas de pago, cortes y jornadas
    assert.ok(modalCode.includes('Venta Acumulada'), 'Debe mostrar tarjeta Venta Acumulada');
    assert.ok(modalCode.includes('Gastos Operativos'), 'Debe mostrar tarjeta Gastos Operativos');
    assert.ok(modalCode.includes('Balance Pre-Prod'), 'Debe mostrar tarjeta Balance Pre-Prod');
    assert.ok(modalCode.includes('Peso Arriendo (≤20%)'), 'Debe mostrar tarjeta Peso Arriendo (≤20%)');
    assert.ok(modalCode.includes('Progreso Meta 20% (5x Arriendo):'), 'Debe mostrar barra de progreso hacia 5x arriendo');
    assert.ok(modalCode.includes('Ritmo diario meta 20%:'), 'Debe mostrar cinta de ritmo diario requerido');
    assert.ok(modalCode.includes('Recaudación:'), 'Debe mostrar resumen consolidado de formas de pago');
    assert.ok(modalCode.includes('Cortes de caja:'), 'Debe mostrar resumen de cortes de caja conciliados/automáticos');
    assert.ok(modalCode.includes('Movimientos por Jornada'), 'Debe mostrar Movimientos por Jornada');
    assert.ok(modalCode.includes('<EventDayCard'), 'Debe renderizar tarjetas diarias EventDayCard');

    // Hooks antes del early return y cota de líneas <= 380
    const earlyReturnIdx = modalCode.indexOf('if (!event) return null;');
    assert.ok(earlyReturnIdx > -1, 'Debe mantener retorno temprano if (!event) return null;');
    const afterReturn = modalCode.slice(earlyReturnIdx);
    assert.ok(!/\buse(?:State|Memo|Effect|Callback)\s*\(/.test(afterReturn), 'Ningún hook de React puede ejecutarse después del retorno temprano');

    const lineCount = modalCode.trim().split('\n').length;
    assert.ok(lineCount <= 380, `EventSalesModal.jsx debe mantenerse <= 380 líneas (actual: ${lineCount})`);
  });

  it('4. Estética blanca/neutra estricta: cero clases naranjas/ámbar en EventsManagementView.jsx y EventSalesModal.jsx', () => {
    const viewCode = fs.readFileSync(path.join(ROOT, 'src/components/EventsManagementView.jsx'), 'utf-8');
    const modalCode = fs.readFileSync(path.join(ROOT, 'src/components/events/modals/EventSalesModal.jsx'), 'utf-8');

    const amberOrangePattern = /\b(?:text|bg|border|ring|shadow|from|to)-(?:amber|orange)-\d+/;
    assert.ok(
      !amberOrangePattern.test(viewCode),
      `EventsManagementView.jsx no debe contener acentos naranjas/ámbar (encontrado: ${viewCode.match(amberOrangePattern)?.[0]})`
    );
    assert.ok(
      !amberOrangePattern.test(modalCode),
      `EventSalesModal.jsx no debe contener acentos naranjas/ámbar (encontrado: ${modalCode.match(amberOrangePattern)?.[0]})`
    );
  });

  it('5. Guardarraíl de compatibilidad: conserva EventFinancialRadar.jsx en disco y valida cálculo del Radar del 20%', () => {
    const radarPath = path.join(ROOT, 'src/components/monitor/EventFinancialRadar.jsx');
    assert.ok(fs.existsSync(radarPath), 'EventFinancialRadar.jsx debe conservarse en disco para compatibilidad con surgery-053');

    const fin = calculateEventFinancials({
      event: { startDate: '2026-11-20', endDate: '2026-11-22' },
      cumulativeSold: 6000,
      dailySold: 2200,
      expenses: [
        { category: 'ARRENDAMIENTO_STAND', amount: 1500 },
        { category: 'ALIMENTACION', amount: 300 },
      ],
    });

    assert.equal(fin.standRentCost, 1500);
    assert.equal(fin.otherOperationalCost, 300);
    assert.equal(fin.totalExpenses, 1800);
    assert.equal(fin.preProductionBalance, 4200);
    assert.equal(fin.healthySalesTarget20Pct, 7500);
    assert.equal(fin.standRentRatioPct, 25);
    assert.equal(fin.totalEventDays, 3);
    assert.equal(fin.requiredDailyRunRate, 2500);
    assert.equal(fin.healthPhase, 'GASTOS_CUBIERTOS_RUMBO_20');
  });
});
