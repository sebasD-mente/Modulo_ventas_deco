import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('🏛️ Digital Event Monitor Unification & Zero-Trust Isolation', () => {
  it('1. monitorKpiService.js firma y queries incluyen eventId', () => {
    const filePath = path.resolve('server/services/sales/monitorKpiService.js');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(
      content.includes('export async function getMonitorDashboardMetrics({ tenantId, date = null, eventId = null })'),
      'La firma de getMonitorDashboardMetrics debe aceptar eventId = null'
    );
    assert.ok(
      content.includes('if (eventId) eventWhere.id = eventId;'),
      'Debe filtrar eventWhere.id si eventId está presente'
    );
    assert.ok(
      content.includes('if (eventId) saleWhere.eventId = eventId;'),
      'Debe filtrar saleWhere.eventId si eventId está presente'
    );
  });

  it('2. saleController.js getMonitorMetrics implementa aislamiento Zero-Trust', () => {
    const filePath = path.resolve('server/controllers/saleController.js');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(
      content.includes("const { date, eventId } = req.query;"),
      'getMonitorMetrics debe extraer date y eventId de req.query'
    );
    assert.ok(
      content.includes("if (isVendedorRedes && !isSuperAdmin && !isVendedor)"),
      'Debe validar condición para vendedor de redes exclusivo'
    );
    assert.ok(
      content.includes("targetEventId = eventId || 'evt-ventas-redes-online';"),
      'Debe forzar canal digital permanente para vendedor de redes'
    );
    assert.ok(
      content.includes("eventId: targetEventId"),
      'Debe pasar targetEventId a getMonitorDashboardMetrics'
    );
  });

  it('3. Header.jsx retira pestaña monitor para VENDEDOR_REDES exclusivo', () => {
    const filePath = path.resolve('src/components/Header.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Extraer bloque if (isVendedorRedes && !isVendedor)
    const match = content.match(/if\s*\(isVendedorRedes\s*&&\s*!isVendedor\)\s*\{([\s\S]*?)\}\s*else/);
    assert.ok(match, 'Debe existir el bloque condicional para VENDEDOR_REDES');
    const blockContent = match[1];

    assert.ok(
      !blockContent.includes("tabMap.set('monitor'"),
      'El bloque VENDEDOR_REDES no debe registrar la pestaña monitor'
    );
    assert.ok(
      blockContent.includes("tabMap.set('venta'"),
      'El bloque VENDEDOR_REDES debe registrar la pestaña venta'
    );
    assert.ok(
      blockContent.includes("tabMap.set('eventos'"),
      'El bloque VENDEDOR_REDES debe registrar la pestaña eventos'
    );
    assert.ok(
      blockContent.includes("tabMap.set('seguimiento'"),
      'El bloque VENDEDOR_REDES debe registrar la pestaña seguimiento'
    );
    assert.ok(
      blockContent.includes("tabMap.set('comisiones'"),
      'El bloque VENDEDOR_REDES debe registrar la pestaña comisiones'
    );
  });

  it('4. DigitalEventMonitorSection.jsx existe y cumple con límites y superficie táctil', () => {
    const filePath = path.resolve('src/components/events/DigitalEventMonitorSection.jsx');
    assert.ok(fs.existsSync(filePath), 'DigitalEventMonitorSection.jsx debe existir');

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines <= 280, `DigitalEventMonitorSection.jsx tiene ${lines} líneas (debe ser <= 280)`);

    assert.ok(
      content.includes("min-h-[44px]"),
      'Los botones táctiles e inputs interactivos deben cumplir con superficie >= 44px'
    );
    assert.ok(
      content.includes("/api/sales/monitor?date=${selectedDate}&eventId=${eventId}"),
      'Debe invocar el endpoint con date y eventId'
    );
    assert.ok(
      content.includes("15000"),
      'Debe refrescar periódicamente cada 15 segundos'
    );
    assert.ok(
      content.includes("MonitorKpiGrid"),
      'Debe renderizar MonitorKpiGrid'
    );
    assert.ok(
      content.includes("PaymentMethodsBreakdown"),
      'Debe renderizar PaymentMethodsBreakdown'
    );
    assert.ok(
      content.includes("No hay ventas registradas en el canal digital para la fecha seleccionada."),
      'Debe contar con empty state limpio'
    );
  });

  it('5. EventsManagementView.jsx incrusta DigitalEventMonitorSection', () => {
    const filePath = path.resolve('src/components/EventsManagementView.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(
      content.includes("import DigitalEventMonitorSection from './events/DigitalEventMonitorSection';"),
      'EventsManagementView.jsx debe importar DigitalEventMonitorSection'
    );
    assert.ok(
      content.includes("<DigitalEventMonitorSection eventId={digitalEvent.id} />"),
      'EventsManagementView.jsx debe renderizar DigitalEventMonitorSection con eventId'
    );
  });
});
