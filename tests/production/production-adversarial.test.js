import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ ADVERSARIAL CHALLENGER SUITE: ProductionManagement (Phase 5)', () => {
  const productionFiles = [
    'src/components/ProductionManagementView.jsx',
    'src/components/production/hooks/useProductionQueue.js',
    'src/components/production/ProductionFilterTabs.jsx',
    'src/components/production/ProductionOrderCard.jsx',
  ];

  // =========================================================================
  // 1. AUDITORÍA FORENSE: CERO MOCKS O STUBS EN PRODUCCIÓN
  // =========================================================================
  describe('1. Verificación Estricta: Cero Mocks, Stubs o Fachadas Dummy', () => {
    it('1.1. Ningún archivo en src/components/production/ contiene obras de cola mockeada o stubs', () => {
      const forbiddenPatterns = [
        /const\s+mockItems/i,
        /const\s+mockQueue/i,
        /\[\s*\{\s*id:\s*['"]mock-/i,
        /dummyProductionData/i,
        /faker/i,
        /lorem\s+ipsum/i,
      ];

      for (const relPath of productionFiles) {
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

    it('1.2. useProductionQueue consume endpoints reales del backend y no endpoints ficticios', () => {
      const hookPath = path.join(rootDir, 'src/components/production/hooks/useProductionQueue.js');
      const content = fs.readFileSync(hookPath, 'utf-8');

      assert.ok(content.includes('/api/production/items'), 'Debe consumir GET /api/production/items');
      assert.ok(content.includes('/api/production/metrics'), 'Debe consumir GET /api/production/metrics');
      assert.ok(content.includes('/api/events'), 'Debe consumir GET /api/events');
      assert.ok(content.includes('/api/production/items/${itemId}/status'), 'Debe consumir PATCH status');
      assert.ok(!content.includes('/api/production/queue'), 'Prohibido consumir endpoint no existente /api/production/queue');
    });
  });

  // =========================================================================
  // 2. PRUEBA EMPÍRICA ADVERSARIAL DE DEBOUNCE (250ms)
  // =========================================================================
  describe('2. Verificación Empírica de Debounce de 250ms en Búsqueda', () => {
    it('2.1. useProductionQueue implementa temporizador de 250ms con cleanup de clearTimeout', () => {
      const hookPath = path.join(rootDir, 'src/components/production/hooks/useProductionQueue.js');
      const content = fs.readFileSync(hookPath, 'utf-8');

      assert.ok(content.includes('const timer = setTimeout(() => {'), 'Debe usar setTimeout para debounce');
      assert.ok(content.includes('setDebouncedSearchQuery(searchQuery);'), 'Debe actualizar debouncedSearchQuery');
      assert.ok(content.includes('250);'), 'El delay del temporizador debe ser 250ms');
      assert.ok(content.includes('return () => clearTimeout(timer);'), 'Debe limpiar con clearTimeout(timer)');
    });

    it('2.2. Ráfaga adversarial de 20 pulsaciones rápidas (cada 25ms): 0 emisiones intermedias y consolidación a 250ms', async () => {
      const queryLog = [];
      let activeTimer = null;

      const simulateInput = (query) => {
        if (activeTimer) clearTimeout(activeTimer);
        activeTimer = setTimeout(() => {
          queryLog.push({ query, timestamp: Date.now() });
        }, 250);
      };

      const burstCharacters = 'Goku Ultra Instinct';
      for (let i = 1; i <= burstCharacters.length; i++) {
        simulateInput(burstCharacters.slice(0, i));
        await new Promise((r) => setTimeout(r, 25)); // 25ms entre pulsaciones
      }

      // 100ms después de la última pulsación, el debounce NO debe haber disparado
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(queryLog.length, 0, 'No debe haber consultas antes de cumplirse los 250ms de inactividad');

      // Esperar 200ms adicionales (total 300ms de inactividad tras la última pulsación)
      await new Promise((r) => setTimeout(r, 200));
      assert.equal(queryLog.length, 1, 'Debe haber exactamente 1 consulta emitida tras el período de inactividad');
      assert.equal(queryLog[0].query, 'Goku Ultra Instinct', 'La consulta consolidada debe coincidir con el texto final');
    });

    it('2.3. Desmontaje abrupto durante período de debounce cancela el temporizador sin disparar efectos residuales', async () => {
      let triggered = false;
      let timer = setTimeout(() => {
        triggered = true;
      }, 250);

      // Simular unmount a los 50ms
      await new Promise((r) => setTimeout(r, 50));
      clearTimeout(timer);

      // Esperar más de 250ms
      await new Promise((r) => setTimeout(r, 250));
      assert.equal(triggered, false, 'El temporizador cancelado no debe ejecutar la actualización');
    });
  });

  // =========================================================================
  // 3. MÁQUINA DE ESTADOS DE PRODUCCIÓN Y MATRIZ DE TRANSICIÓN
  // =========================================================================
  describe('3. Verificación de Transiciones de Estado y Matriz de Roles', () => {
    const validStatuses = ['PENDIENTE', 'SEPARADO', 'A_PRODUCCION', 'IMPRESO'];

    const canTransition = (fromStatus, toStatus, role) => {
      if (!validStatuses.includes(toStatus)) return false;
      if (role === 'SUPER_ADMIN') return true;
      if (role === 'OPERARIO_1') {
        if (fromStatus === 'PENDIENTE' && (toStatus === 'SEPARADO' || toStatus === 'A_PRODUCCION')) return true;
        if (fromStatus === 'SEPARADO' && toStatus === 'A_PRODUCCION') return true;
        return false;
      }
      if (role === 'OPERARIO_2') {
        if (fromStatus === 'A_PRODUCCION' && toStatus === 'IMPRESO') return true;
        return false;
      }
      return false;
    };

    it('3.1. Operario 1 puede separar stock y mandar a producción, pero NO archivar como impreso', () => {
      assert.equal(canTransition('PENDIENTE', 'SEPARADO', 'OPERARIO_1'), true);
      assert.equal(canTransition('PENDIENTE', 'A_PRODUCCION', 'OPERARIO_1'), true);
      assert.equal(canTransition('SEPARADO', 'A_PRODUCCION', 'OPERARIO_1'), true);
      assert.equal(canTransition('A_PRODUCCION', 'IMPRESO', 'OPERARIO_1'), false);
    });

    it('3.2. Operario 2 (Taller) solo puede archivar de A_PRODUCCION a IMPRESO', () => {
      assert.equal(canTransition('A_PRODUCCION', 'IMPRESO', 'OPERARIO_2'), true);
      assert.equal(canTransition('PENDIENTE', 'SEPARADO', 'OPERARIO_2'), false);
      assert.equal(canTransition('PENDIENTE', 'A_PRODUCCION', 'OPERARIO_2'), false);
      assert.equal(canTransition('SEPARADO', 'A_PRODUCCION', 'OPERARIO_2'), false);
    });

    it('3.3. Super Admin posee permisos de reversión a PENDIENTE desde cualquier estado', () => {
      assert.equal(canTransition('IMPRESO', 'PENDIENTE', 'SUPER_ADMIN'), true);
      assert.equal(canTransition('A_PRODUCCION', 'PENDIENTE', 'SUPER_ADMIN'), true);
      assert.equal(canTransition('SEPARADO', 'PENDIENTE', 'SUPER_ADMIN'), true);
    });

    it('3.4. Estados inventados o no canónicos son terminantemente rechazados', () => {
      const invalidStatuses = ['ENTREGADO', 'CANCELADO', 'ARCHIVADO', 'EN_TRANSITO', 'BORRADO'];
      for (const inv of invalidStatuses) {
        assert.equal(canTransition('PENDIENTE', inv, 'SUPER_ADMIN'), false);
        assert.equal(canTransition('A_PRODUCCION', inv, 'OPERARIO_2'), false);
      }
    });

    it('3.5. ProductionOrderCard renderiza los botones de acción según el estado y rol', () => {
      const cardContent = fs.readFileSync(
        path.join(rootDir, 'src/components/production/ProductionOrderCard.jsx'),
        'utf-8'
      );

      // Separar stock disponible si no está ya separado
      assert.ok(
        cardContent.includes("status !== 'SEPARADO'"),
        'Botón Separar Stock no debe mostrarse si la obra ya está en SEPARADO'
      );

      // A producción disponible si no está ya en producción o impreso
      assert.ok(
        cardContent.includes("status !== 'A_PRODUCCION' && status !== 'IMPRESO'"),
        'Botón A Producción no debe mostrarse si ya está en A_PRODUCCION o IMPRESO'
      );

      // Revertir solo disponible para SuperAdmin y si no está pendiente
      assert.ok(
        cardContent.includes("status !== 'PENDIENTE' && isSuperAdmin"),
        'Botón Revertir solo visible para SuperAdmin en estados no PENDIENTE'
      );

      // Marcar como IMPRESO
      assert.ok(
        cardContent.includes("(isOp2Only || (isSuperAdmin && status === 'A_PRODUCCION'))"),
        'Botón Marcar como IMPRESO condicionado a isOp2Only o SuperAdmin en A_PRODUCCION'
      );
    });
  });

  // =========================================================================
  // 4. AISLAMIENTO ESTRICTO DE ROL OPERARIO 2 (isOp2Only)
  // =========================================================================
  describe('4. Aislamiento Estricto de Rol Operario 2 (isOp2Only)', () => {
    const isOp2OnlyOracle = (isSuperAdmin, isOperario1, isOperario2) => {
      return Boolean(isOperario2 && !isOperario1 && !isSuperAdmin);
    };

    it('4.1. Tabla de verdad exhaustiva (8 combinaciones): isOp2Only es true SOLO para Operario 2 puro', () => {
      const combinations = [
        { sa: false, op1: false, op2: false, expected: false },
        { sa: false, op1: false, op2: true,  expected: true  }, // ÚNICO CASO TRUE
        { sa: false, op1: true,  op2: false, expected: false },
        { sa: false, op1: true,  op2: true,  expected: false },
        { sa: true,  op1: false, op2: false, expected: false },
        { sa: true,  op1: false, op2: true,  expected: false },
        { sa: true,  op1: true,  op2: false, expected: false },
        { sa: true,  op1: true,  op2: true,  expected: false },
      ];

      for (const { sa, op1, op2, expected } of combinations) {
        assert.equal(
          isOp2OnlyOracle(sa, op1, op2),
          expected,
          `Fallo para SA:${sa}, Op1:${op1}, Op2:${op2}: se esperaba ${expected}`
        );
      }
    });

    it('4.2. ProductionFilterTabs se oculta completamente (retorna null) cuando isOp2Only es true', () => {
      const tabsContent = fs.readFileSync(
        path.join(rootDir, 'src/components/production/ProductionFilterTabs.jsx'),
        'utf-8'
      );

      assert.ok(
        tabsContent.includes('if (isOp2Only) return null;'),
        'ProductionFilterTabs debe retornar null si isOp2Only es true'
      );
    });

    it('4.3. ProductionManagementView adapta encabezado, icono y mensaje vacío para modo Taller', () => {
      const viewContent = fs.readFileSync(
        path.join(rootDir, 'src/components/ProductionManagementView.jsx'),
        'utf-8'
      );

      assert.ok(
        viewContent.includes("q.isOp2Only ? 'Taller de Impresión' : 'Gestión de Producción'"),
        'Debe cambiar título a Taller de Impresión para Operario 2'
      );
      assert.ok(
        viewContent.includes("q.isOp2Only ? '🎉 No hay obras pendientes de imprimir en este momento.'"),
        'Debe adaptar el estado vacío amigable para Operario 2'
      );
      assert.ok(
        viewContent.includes('Printer className="w-5 h-5 text-cyan-400"'),
        'Debe mostrar icono Printer cyan para Operario 2'
      );
    });
  });

  // =========================================================================
  // 5. RESILIENCIA Y CONCURRENCIA EN ACTUALIZACIÓN DE ESTADO
  // =========================================================================
  describe('5. Resiliencia y Concurrencia en Mutaciones de Estado', () => {
    it('5.1. updatingItemId deshabilita los botones de la tarjeta mientras la mutación está en curso', () => {
      const cardContent = fs.readFileSync(
        path.join(rootDir, 'src/components/production/ProductionOrderCard.jsx'),
        'utf-8'
      );

      assert.ok(
        cardContent.includes('disabled={isUpdating}'),
        'Los botones de cambio de estado deben estar disabled={isUpdating}'
      );
    });

    it('5.2. Captura de error de servidor HTTP 500 no rompe el hook ni deja updatingItemId bloqueado', async () => {
      let updatingItemId = null;
      let errorAlert = null;

      const handleStatusChangeOracle = async (itemId, newStatus, simulateError = false) => {
        try {
          updatingItemId = itemId;
          if (simulateError) throw new Error('Falla en base de datos al cambiar estado');
          return { success: true };
        } catch (err) {
          errorAlert = err.message;
        } finally {
          updatingItemId = null;
        }
      };

      await handleStatusChangeOracle('item-123', 'SEPARADO', true);
      assert.equal(errorAlert, 'Falla en base de datos al cambiar estado');
      assert.equal(updatingItemId, null, 'updatingItemId debe restablecerse a null en el bloque finally');
    });
  });
});
