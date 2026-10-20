import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('⚔️ CIRUGÍA [DEKO-STANDIA-058]: Transparencia y Cuadre Contable en Rendimiento en Vivo y Ventas', () => {

  // ==========================================================================
  // BLOQUE 1: Contrato Matemático de monitorKpiService.js
  // ==========================================================================
  describe('1. Contrato Matemático en server/services/sales/monitorKpiService.js', () => {
    it('1.1. monitorKpiService.js calcula totalSold, totalCollected y pendingBalanceTotal garantizando cuadre exacto', () => {
      const serviceContent = fs.readFileSync(path.join(ROOT, 'server/services/sales/monitorKpiService.js'), 'utf-8');
      
      assert.ok(serviceContent.includes('totalCollected: evCollected'), 'eventDetails debe exponer totalCollected');
      assert.ok(serviceContent.includes('pendingBalanceTotal: evPendingBalance'), 'eventDetails debe exponer pendingBalanceTotal');
      assert.ok(serviceContent.includes('totalCollected: grandCollected'), 'resumenGeneral debe exponer totalCollected');
      assert.ok(serviceContent.includes('pendingBalanceTotal: grandPendingBalance'), 'resumenGeneral debe exponer pendingBalanceTotal');

      // Verificación de la fórmula de saldo por cobrar y cuadre exacto
      assert.ok(
        serviceContent.includes('Math.max(0, Number((evTotal - evCollected).toFixed(2)))'),
        'evPendingBalance debe calcularse como evTotal - evCollected con Math.max y 2 decimales'
      );
      assert.ok(
        serviceContent.includes('Math.max(0, Number((grandTotal - grandCollected).toFixed(2)))'),
        'grandPendingBalance debe calcularse como grandTotal - grandCollected con Math.max y 2 decimales'
      );
    });

    it('1.2. monitorKpiService.js calcula porcentajes de métodos de pago sobre totalCollected (no sobre totalSold)', () => {
      const serviceContent = fs.readFileSync(path.join(ROOT, 'server/services/sales/monitorKpiService.js'), 'utf-8');
      
      assert.ok(serviceContent.includes('(payments.TARJETA.amount / evCollected) * 100'), 'Porcentaje de tarjeta debe calcularse sobre evCollected');
      assert.ok(serviceContent.includes('(globalPayments.TARJETA.amount / grandCollected) * 100'), 'Porcentaje global de tarjeta debe calcularse sobre grandCollected');
    });

    it('1.3. Oráculo matemático: simulación de órdenes 50/50, pagos mixtos y saldo abierto', () => {
      // Simulación del caso real documentado en el ticket 058:
      // VENT-0002: Total Q200.00 (Q100 Transferencia + Q100 Efectivo)
      // VENT-0003: Total Q385.00 (Q198.50 Tarjeta anticipo + Q186.50 saldo pendiente)
      const sales = [
        {
          id: 's-2',
          saleNumber: 'VENT-0002',
          totalAmount: 200.00,
          balanceDue: 0.00,
          payments: [
            { method: 'TRANSFERENCIA', amount: 100.00 },
            { method: 'EFECTIVO', amount: 100.00 },
          ],
        },
        {
          id: 's-3',
          saleNumber: 'VENT-0003',
          totalAmount: 385.00,
          balanceDue: 186.50,
          payments: [
            { method: 'TARJETA', amount: 198.50 },
          ],
        },
      ];

      let totalSold = 0;
      let totalCollected = 0;
      const payments = {
        TARJETA: { amount: 0, count: 0, percentage: 0 },
        TRANSFERENCIA: { amount: 0, count: 0, percentage: 0 },
        EFECTIVO: { amount: 0, count: 0, percentage: 0 },
        OTRO: { amount: 0, count: 0, percentage: 0 },
      };

      sales.forEach((s) => {
        totalSold += Number(s.totalAmount);
        s.payments.forEach((p) => {
          payments[p.method].amount = Number((payments[p.method].amount + p.amount).toFixed(2));
          payments[p.method].count += 1;
        });
      });

      totalSold = Number(totalSold.toFixed(2));
      totalCollected = Number(
        (payments.TARJETA.amount + payments.TRANSFERENCIA.amount + payments.EFECTIVO.amount + payments.OTRO.amount).toFixed(2)
      );
      const pendingBalanceTotal = Number(Math.max(0, Number((totalSold - totalCollected).toFixed(2))).toFixed(2));

      // Aserciones estrictas del cuadre contable
      assert.equal(totalSold, 585.00, 'Total vendido debe ser Q 585.00');
      assert.equal(totalCollected, 398.50, 'Total cobrado en caja debe ser Q 398.50');
      assert.equal(pendingBalanceTotal, 186.50, 'Saldo por cobrar debe ser Q 186.50');
      assert.equal(Number((totalCollected + pendingBalanceTotal).toFixed(2)), totalSold, 'totalCollected + pendingBalanceTotal DEBE ser exactamente igual a totalSold');

      // Porcentajes de métodos de pago
      if (totalCollected > 0) {
        payments.TARJETA.percentage = Number(((payments.TARJETA.amount / totalCollected) * 100).toFixed(1));
        payments.TRANSFERENCIA.percentage = Number(((payments.TRANSFERENCIA.amount / totalCollected) * 100).toFixed(1));
        payments.EFECTIVO.percentage = Number(((payments.EFECTIVO.amount / totalCollected) * 100).toFixed(1));
      }

      assert.equal(payments.TARJETA.percentage, 49.8, 'Tarjeta debe ser 49.8% de lo efectivamente cobrado');
      assert.equal(payments.TRANSFERENCIA.percentage, 25.1, 'Transferencia debe ser 25.1% de lo cobrado');
      assert.equal(payments.EFECTIVO.percentage, 25.1, 'Efectivo debe ser 25.1% de lo cobrado');
    });
  });

  // ==========================================================================
  // BLOQUE 2: MonitorKpiGrid y Llamadores
  // ==========================================================================
  describe('2. Integridad de Props y Desglose Visual en MonitorKpiGrid y Llamadores', () => {
    it('2.1. MonitorKpiGrid.jsx desglosa Cobrado en caja y Saldo por cobrar en modo event y general', () => {
      const gridContent = fs.readFileSync(path.join(ROOT, 'src/components/monitor/MonitorKpiGrid.jsx'), 'utf-8');
      
      assert.ok(gridContent.includes('totalCollected'), 'MonitorKpiGrid debe recibir prop totalCollected');
      assert.ok(gridContent.includes('pendingBalanceTotal = 0'), 'MonitorKpiGrid debe recibir prop pendingBalanceTotal');
      assert.ok(gridContent.includes('✅ Cobrado en caja:'), 'Debe renderizar etiqueta ✅ Cobrado en caja:');
      assert.ok(gridContent.includes('⏳ Saldo por cobrar:'), 'Debe renderizar condicionalmente ⏳ Saldo por cobrar:');
    });

    it('2.2. DigitalEventMonitorSection.jsx pasa totalCollected y pendingBalanceTotal a MonitorKpiGrid', () => {
      const sectionContent = fs.readFileSync(path.join(ROOT, 'src/components/events/DigitalEventMonitorSection.jsx'), 'utf-8');
      
      assert.ok(sectionContent.includes('totalCollected={eventDetail.totalCollected}'), 'Debe pasar totalCollected');
      assert.ok(sectionContent.includes('pendingBalanceTotal={eventDetail.pendingBalanceTotal}'), 'Debe pasar pendingBalanceTotal');
    });

    it('2.3. EventsPerformanceList.jsx pasa totalCollected y pendingBalanceTotal a MonitorKpiGrid', () => {
      const listContent = fs.readFileSync(path.join(ROOT, 'src/components/monitor/EventsPerformanceList.jsx'), 'utf-8');
      
      assert.ok(listContent.includes('totalCollected={ev.totalCollected}'), 'Debe pasar totalCollected');
      assert.ok(listContent.includes('pendingBalanceTotal={ev.pendingBalanceTotal}'), 'Debe pasar pendingBalanceTotal');
    });

    it('2.4. MonitorDashboardView.jsx pasa totalCollected y pendingBalanceTotal a MonitorKpiGrid en resumen general', () => {
      const viewContent = fs.readFileSync(path.join(ROOT, 'src/components/MonitorDashboardView.jsx'), 'utf-8');
      
      assert.ok(viewContent.includes('totalCollected={resumenGeneral.totalCollected}'), 'Debe pasar totalCollected');
      assert.ok(viewContent.includes('pendingBalanceTotal={resumenGeneral.pendingBalanceTotal}'), 'Debe pasar pendingBalanceTotal');
    });
  });

  // ==========================================================================
  // BLOQUE 3: PaymentMethodsBreakdown y Etiquetas Honestas
  // ==========================================================================
  describe('3. Honestidad Visual en Métodos de Pago (PaymentMethodsBreakdown)', () => {
    it('3.1. PaymentMethodsBreakdown.jsx usa "pago / abono" y "pagos / abonos" para evitar falsas sumas de ventas', () => {
      const breakdownContent = fs.readFileSync(path.join(ROOT, 'src/components/monitor/PaymentMethodsBreakdown.jsx'), 'utf-8');
      
      assert.ok(breakdownContent.includes("'pago / abono' : 'pagos / abonos'"), 'Debe usar la lógica singular/plural de pago / abono');
      assert.ok(!breakdownContent.includes('ventas\n'), 'No debe usar la palabra ventas en las tarjetas de métodos de pago');
    });
  });

  // ==========================================================================
  // BLOQUE 4: RecentSaleRow y EventDayCard (Pagos Múltiples y Envío)
  // ==========================================================================
  describe('4. Desglose Exhaustivo de Pagos Múltiples, Envío y Descuentos en Ventas', () => {
    it('4.1. RecentSaleRow.jsx renderiza todos los pagos cuando payments.length > 1 o hasBalance', () => {
      const rowContent = fs.readFileSync(path.join(ROOT, 'src/components/sales/RecentSaleRow.jsx'), 'utf-8');
      
      assert.ok(rowContent.includes('renderPaymentBadges'), 'Debe contar con renderPaymentBadges');
      assert.ok(rowContent.includes('payments.length > 1 || hasBalance'), 'Debe iterar sobre todos los pagos si hay múltiples o saldo');
      assert.ok(rowContent.includes('tag = hasBalance ? \' (Abono)\' : \'\''), 'Debe rotular Abono cuando hay saldo pendiente');
    });

    it('4.2. RecentSaleRow.jsx muestra explícitamente la fila de envío y descuento para cuadrar con el total', () => {
      const rowContent = fs.readFileSync(path.join(ROOT, 'src/components/sales/RecentSaleRow.jsx'), 'utf-8');
      
      assert.ok(rowContent.includes('Number(sale.shippingCost || 0) > 0'), 'Debe verificar shippingCost');
      assert.ok(rowContent.includes('🚚 Envío ('), 'Debe renderizar la fila con icono de camión');
      assert.ok(rowContent.includes('Number(sale.discount || 0) > 0'), 'Debe verificar discount');
      assert.ok(rowContent.includes('🏷️ Descuento aplicado:'), 'Debe renderizar descuento si existe');
    });

    it('4.3. EventDayCard.jsx renderiza todos los pagos y costo de envío', () => {
      const cardContent = fs.readFileSync(path.join(ROOT, 'src/components/events/daily/EventDayCard.jsx'), 'utf-8');
      
      assert.ok(cardContent.includes('sale.payments && sale.payments.length > 1'), 'Debe desglosar pagos si hay más de 1');
      assert.ok(cardContent.includes('Number(sale.shippingCost || 0) > 0'), 'Debe verificar shippingCost');
      assert.ok(cardContent.includes('🚚 Envío ('), 'Debe renderizar la fila de envío');
    });
  });

  // ==========================================================================
  // BLOQUE 5: EventsManagementView - Diferenciación Semántica
  // ==========================================================================
  describe('5. Diferenciación Semántica de Acumulado Histórico en EventsManagementView', () => {
    it('5.1. EventsManagementView.jsx titula "Acumulado Histórico" en la tarjeta del POS Digital', () => {
      const eventsViewContent = fs.readFileSync(path.join(ROOT, 'src/components/EventsManagementView.jsx'), 'utf-8');
      
      assert.ok(eventsViewContent.includes('Acumulado Histórico'), 'Debe contener la etiqueta Acumulado Histórico');
      // No debe contener Total Vendido en el contenedor superior del POS permanente
      const cardMatches = eventsViewContent.match(/data-testid="permanent-digital-pos-card"[\s\S]*?<\/div>\s*<\/div>/g) || [];
      for (const cardHtml of cardMatches) {
        assert.ok(!cardHtml.includes('>Total Vendido<'), 'No debe tener etiqueta Total Vendido en la cabecera del POS permanente');
      }
    });
  });
});
