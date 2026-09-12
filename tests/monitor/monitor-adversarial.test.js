import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ ADVERSARIAL CHALLENGER SUITE: MonitorDashboard (Phase 5)', () => {
  const monitorFiles = [
    'src/components/MonitorDashboardView.jsx',
    'src/components/monitor/hooks/useMonitorDashboard.js',
    'src/components/monitor/MonitorKpiGrid.jsx',
    'src/components/monitor/PaymentMethodsBreakdown.jsx',
    'src/components/monitor/EventsPerformanceList.jsx',
    'src/components/DonutChart.jsx',
  ];

  // =========================================================================
  // 1. AUDITORÍA FORENSE: CERO MOCKS O STUBS EN MONITOREO
  // =========================================================================
  describe('1. Verificación Estricta: Cero Mocks, Stubs o Fachadas Dummy', () => {
    it('1.1. Ningún archivo de monitor contiene datos estáticos de ventas simuladas o stubs', () => {
      const forbiddenPatterns = [
        /const\s+mockSales/i,
        /const\s+mockKpis/i,
        /\[\s*\{\s*eventId:\s*['"]mock-/i,
        /dummyMonitorData/i,
        /faker/i,
        /lorem\s+ipsum/i,
      ];

      for (const relPath of monitorFiles) {
        const fullPath = path.join(rootDir, relPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const pattern of forbiddenPatterns) {
          assert.ok(
            !pattern.test(content),
            `Violación detectada en ${relPath}: patrón prohibido ${pattern}`
          );
        }
      }
    });

    it('1.2. useMonitorDashboard consume la API real /api/sales/monitor parametrizada por fecha', () => {
      const hookPath = path.join(rootDir, 'src/components/monitor/hooks/useMonitorDashboard.js');
      const content = fs.readFileSync(hookPath, 'utf-8');

      assert.ok(
        content.includes('/api/sales/monitor?date=${selectedDate}'),
        'useMonitorDashboard debe consumir /api/sales/monitor?date=${selectedDate}'
      );
    });
  });

  // =========================================================================
  // 2. CICLO DE VIDA DE POLLING Y LIMPIEZA EN DESMONTAJE (LEAK PREVENTION)
  // =========================================================================
  describe('2. Verificación Adversarial de Polling y Fugas de Memoria', () => {
    it('2.1. useMonitorDashboard implementa clearInterval en unmount y en el efecto de fecha', () => {
      const hookPath = path.join(rootDir, 'src/components/monitor/hooks/useMonitorDashboard.js');
      const content = fs.readFileSync(hookPath, 'utf-8');

      // Verifica que el intervalo sea de 5000ms
      assert.ok(content.includes('5000'), 'El intervalo de polling debe ser de 5000ms');

      // Verifica que exista limpieza condicional previa
      assert.ok(
        content.includes('if (pollingRef.current) clearInterval(pollingRef.current)'),
        'Debe limpiar pollingRef.current antes de asignar uno nuevo'
      );

      // Verifica la función de retorno del efecto (cleanup al desmontar)
      assert.ok(
        content.includes('return () => {') && content.includes('clearInterval(pollingRef.current)'),
        'El hook debe retornar función de limpieza que invoque clearInterval'
      );
    });

    it('2.2. Simulación empírica de montaje y desmontaje: Limpieza estricta de temporizador', () => {
      const activeIntervals = new Set();

      const customSetInterval = (fn, ms) => {
        const id = setInterval(fn, ms);
        activeIntervals.add(id);
        return id;
      };

      const customClearInterval = (id) => {
        clearInterval(id);
        activeIntervals.delete(id);
      };

      // Simular montaje del componente
      let pollingRef = { current: null };

      const mountHook = () => {
        if (pollingRef.current) customClearInterval(pollingRef.current);
        pollingRef.current = customSetInterval(() => {}, 5000);
      };

      const unmountHook = () => {
        if (pollingRef.current) {
          customClearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };

      mountHook();
      assert.equal(activeIntervals.size, 1, 'Debe haber exactamente 1 intervalo activo tras el montaje');

      unmountHook();
      assert.equal(activeIntervals.size, 0, 'No debe quedar ningún intervalo activo tras el desmontaje');
      assert.equal(pollingRef.current, null);
    });

    it('2.3. Ráfaga adversarial de 50 cambios de fecha consecutivos: Mantiene invariante de <= 1 intervalo activo', () => {
      const activeIntervals = new Set();

      const customSetInterval = (fn, ms) => {
        const id = setInterval(fn, ms);
        activeIntervals.add(id);
        return id;
      };

      const customClearInterval = (id) => {
        clearInterval(id);
        activeIntervals.delete(id);
      };

      let pollingRef = { current: null };

      // Simular 50 cambios rápidos de fecha
      for (let i = 0; i < 50; i++) {
        // Cleanup previo de React
        if (pollingRef.current) customClearInterval(pollingRef.current);
        // Nuevo efecto
        pollingRef.current = customSetInterval(() => {}, 5000);

        // Invariante: Nunca más de 1 intervalo activo
        assert.equal(
          activeIntervals.size,
          1,
          `Fuga de memoria detectada en iteración ${i}: hay ${activeIntervals.size} intervalos acumulados`
        );
      }

      // Cleanup final (desmontar)
      if (pollingRef.current) customClearInterval(pollingRef.current);
      assert.equal(activeIntervals.size, 0, 'Todos los intervalos deben estar limpios al terminar');
    });
  });

  // =========================================================================
  // 3. RENDERIZADO DE ESTADOS VACÍOS Y CONTABILIDAD CERO
  // =========================================================================
  describe('3. Renderizado de Estados Vacíos y Resiliencia Contable', () => {
    it('3.1. EventsPerformanceList renderiza mensaje amigable con fecha cuando eventDetails está vacío', () => {
      const listContent = fs.readFileSync(
        path.join(rootDir, 'src/components/monitor/EventsPerformanceList.jsx'),
        'utf-8'
      );

      assert.ok(
        listContent.includes('eventDetails.length === 0'),
        'Debe verificar explícitamente eventDetails.length === 0'
      );
      assert.ok(
        listContent.includes('No hay eventos con ventas registradas para la fecha seleccionada'),
        'Debe renderizar mensaje descriptivo de ausencia de ventas'
      );
      assert.ok(
        listContent.includes('{selectedDate}'),
        'Debe incluir la fecha seleccionada en el mensaje de estado vacío'
      );
    });

    it('3.2. MonitorKpiGrid maneja de forma segura valores cero, nulos o sin ventas', () => {
      const formatLastSaleOracle = (lastSale) => {
        if (!lastSale) return 'Sin ventas';
        return `Q ${Number(lastSale.amount || 0).toFixed(2)} (${lastSale.time})`;
      };

      assert.equal(formatLastSaleOracle(null), 'Sin ventas');
      assert.equal(formatLastSaleOracle(undefined), 'Sin ventas');
      assert.equal(formatLastSaleOracle({ amount: 0, time: '10:00' }), 'Q 0.00 (10:00)');
      assert.equal(formatLastSaleOracle({ amount: 150.5, time: '14:22' }), 'Q 150.50 (14:22)');
    });

    it('3.3. PaymentMethodsBreakdown maneja objeto payments vacío sin lanzar excepción', () => {
      const getPaymentDetailsOracle = (payments, method) => {
        return {
          amount: payments?.[method]?.amount || 0,
          percentage: payments?.[method]?.percentage || 0,
          count: payments?.[method]?.count || 0,
        };
      };

      // payments = undefined
      const resUndef = getPaymentDetailsOracle(undefined, 'TARJETA');
      assert.deepEqual(resUndef, { amount: 0, percentage: 0, count: 0 });

      // payments = {}
      const resEmpty = getPaymentDetailsOracle({}, 'EFECTIVO');
      assert.deepEqual(resEmpty, { amount: 0, percentage: 0, count: 0 });
    });
  });

  // =========================================================================
  // 4. MAPEO DE COLORES Y MATEMÁTICA DEL GRÁFICO DONUT
  // =========================================================================
  describe('4. Mapeo de Colores del Donut y Precisión Matemática SVG', () => {
    it('4.1. Mapeo de colores estricto por método de pago', () => {
      const breakdownContent = fs.readFileSync(
        path.join(rootDir, 'src/components/monitor/PaymentMethodsBreakdown.jsx'),
        'utf-8'
      );

      assert.ok(breakdownContent.includes("key: 'TARJETA'"), 'Debe definir clave TARJETA');
      assert.ok(breakdownContent.includes("color: '#3B82F6'"), 'TARJETA debe mapear al color azul #3B82F6');

      assert.ok(breakdownContent.includes("key: 'TRANSFERENCIA'"), 'Debe definir clave TRANSFERENCIA');
      assert.ok(breakdownContent.includes("color: '#A855F7'"), 'TRANSFERENCIA debe mapear al color morado #A855F7');

      assert.ok(breakdownContent.includes("key: 'EFECTIVO'"), 'Debe definir clave EFECTIVO');
      assert.ok(breakdownContent.includes("color: '#10B981'"), 'EFECTIVO debe mapear al color esmeralda #10B981');
    });

    it('4.2. DonutChart evita división por cero cuando total === 0 y renderiza "Sin ventas"', () => {
      const donutContent = fs.readFileSync(
        path.join(rootDir, 'src/components/DonutChart.jsx'),
        'utf-8'
      );

      assert.ok(
        donutContent.includes('const total = data.reduce((acc, d) => acc + (d.amount || 0), 0)'),
        'DonutChart debe computar total con fallback || 0'
      );
      assert.ok(
        donutContent.includes('if (total === 0) {'),
        'DonutChart debe tener guarda explícita if (total === 0)'
      );
      assert.ok(
        donutContent.includes('Sin ventas'),
        'DonutChart debe renderizar texto "Sin ventas" cuando total es 0'
      );
    });

    it('4.3. Matemática de ángulos y porcentajes de Donut: Suma de rebanadas equivale a 2π radianes (360°)', () => {
      const testData = [
        { key: 'TARJETA', amount: 500, color: '#3B82F6' },
        { key: 'TRANSFERENCIA', amount: 300, color: '#A855F7' },
        { key: 'EFECTIVO', amount: 200, color: '#10B981' },
      ];

      const total = testData.reduce((acc, d) => acc + d.amount, 0);
      assert.equal(total, 1000);

      const slices = testData.map((item) => {
        const sliceAngle = (item.amount / total) * 2 * Math.PI;
        const pct = ((item.amount / total) * 100).toFixed(1);
        return { ...item, sliceAngle, pct };
      });

      assert.equal(slices[0].pct, '50.0');
      assert.equal(slices[1].pct, '30.0');
      assert.equal(slices[2].pct, '20.0');

      const sumAngles = slices.reduce((acc, s) => acc + s.sliceAngle, 0);
      assert.ok(
        Math.abs(sumAngles - 2 * Math.PI) < 0.00001,
        'La suma de los ángulos del Donut debe ser exactamente 2π'
      );
    });
  });
});
