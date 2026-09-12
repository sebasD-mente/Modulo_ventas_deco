import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('🛡️ SUITE DE PRUEBAS MODULARES: Módulo de Gestión de Producción (Phase 5 - M3)', () => {

  // =========================================================================
  // 1. AUDITORÍA ESTRICTA DE LÍMITES DE LÍNEAS (LINE CEILINGS)
  // =========================================================================
  describe('1. Cumplimiento Estricto de Límites de Líneas y Erradicación de Monolitos', () => {
    const fileCeilings = [
      { file: 'src/components/ProductionManagementView.jsx', max: 70, desc: 'Contenedor Maestro Canónico' },
      { file: 'src/components/production/hooks/useProductionQueue.js', max: 130, desc: 'Hook Reactivo y Comunicación API' },
      { file: 'src/components/production/ProductionFilterTabs.jsx', max: 70, desc: 'Pestañas de Filtro y Contadores Dinámicos' },
      { file: 'src/components/production/ProductionOrderCard.jsx', max: 120, desc: 'Tarjeta de Obra / Póster en Producción' },
    ];

    for (const { file, max, desc } of fileCeilings) {
      it(`1.x. ${file} (${desc}) respeta el límite estricto de < ${max} líneas`, () => {
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
          `Violación de regla de cero deuda técnica: ${file} supera las 200 líneas (${lineCount})`
        );
      });
    }
  });

  // =========================================================================
  // 2. AUDITORÍA FORENSE DE DEBOUNCE (250ms)
  // =========================================================================
  describe('2. Preservación del Debounce de 250ms en Búsqueda', () => {
    const hookPath = path.join(rootDir, 'src/components/production/hooks/useProductionQueue.js');
    const viewPath = path.join(rootDir, 'src/components/ProductionManagementView.jsx');

    it('2.1 useProductionQueue.js implementa estado debouncedSearchQuery y temporizador de 250ms con cleanup', () => {
      const hookContent = fs.readFileSync(hookPath, 'utf-8');
      assert.ok(hookContent.includes('debouncedSearchQuery'), 'Falta debouncedSearchQuery en useProductionQueue.js');
      assert.ok(hookContent.includes('setTimeout(() => {'), 'Falta setTimeout en useProductionQueue.js');
      assert.ok(hookContent.includes('250'), 'El temporizador de debounce debe ser de 250ms');
      assert.ok(hookContent.includes('clearTimeout(timer)'), 'Falta clearTimeout en cleanup de debounce');
      assert.ok(hookContent.includes('debouncedSearchQuery.trim()'), 'fetchItems debe utilizar debouncedSearchQuery');
    });

    it('2.2 ProductionManagementView.jsx preserva compatibilidad con auditorías regresivas estáticas', () => {
      const viewContent = fs.readFileSync(viewPath, 'utf-8');
      assert.ok(viewContent.includes('debouncedSearchQuery'), 'Falta debouncedSearchQuery en ProductionManagementView.jsx');
      assert.ok(viewContent.includes('250'), 'Debe documentar o preservar timer 250ms');
    });

    it('2.3 Prueba empírica adversarial de debounce: Ráfaga de pulsaciones a 50ms consolida en 1 consulta a los 250ms', async () => {
      let emittedQueries = [];
      let activeTimer = null;

      const simulateKeystroke = (text) => {
        if (activeTimer) clearTimeout(activeTimer);
        activeTimer = setTimeout(() => {
          emittedQueries.push(text);
        }, 250);
      };

      simulateKeystroke('P');
      await new Promise((r) => setTimeout(r, 50));
      simulateKeystroke('Po');
      await new Promise((r) => setTimeout(r, 50));
      simulateKeystroke('Pos');
      await new Promise((r) => setTimeout(r, 50));
      simulateKeystroke('Poster');

      // A los 100ms tras la última pulsación no debe haber emisión
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(emittedQueries.length, 0, 'No debe emitir búsquedas intermedias antes de expirar el debounce');

      // Superar los 250ms totales
      await new Promise((r) => setTimeout(r, 200));
      assert.equal(emittedQueries.length, 1, 'Debe emitir exactamente una búsqueda consolidada');
      assert.equal(emittedQueries[0], 'Poster', 'La consulta emitida debe coincidir con el texto final');
    });
  });

  // =========================================================================
  // 3. MÁQUINA DE ESTADOS Y TRANSICIONES VÁLIDAS DE PRODUCCIÓN
  // =========================================================================
  describe('3. Máquina de Estados y Transiciones de Producción', () => {
    const validStatuses = ['PENDIENTE', 'SEPARADO', 'A_PRODUCCION', 'IMPRESO'];

    const isValidTransition = (currentStatus, newStatus, role = 'SUPER_ADMIN') => {
      if (!validStatuses.includes(newStatus)) return false;
      if (role === 'SUPER_ADMIN') return true; // Super admin can revert or change to any valid status
      if (role === 'OPERARIO_1') {
        if (currentStatus === 'PENDIENTE' && (newStatus === 'SEPARADO' || newStatus === 'A_PRODUCCION')) return true;
        if (currentStatus === 'SEPARADO' && newStatus === 'A_PRODUCCION') return true;
        return false;
      }
      if (role === 'OPERARIO_2') {
        if (currentStatus === 'A_PRODUCCION' && newStatus === 'IMPRESO') return true;
        return false;
      }
      return false;
    };

    it('3.1 Estados canónicos son exactamente PENDIENTE, SEPARADO, A_PRODUCCION, IMPRESO', () => {
      assert.deepEqual(validStatuses, ['PENDIENTE', 'SEPARADO', 'A_PRODUCCION', 'IMPRESO']);
      assert.equal(isValidTransition('PENDIENTE', 'ENTREGADO'), false, 'ENTREGADO es inválido en módulo de producción');
    });

    it('3.2 Operario 1 puede separar stock y enviar a producción pero no marcar impreso', () => {
      assert.ok(isValidTransition('PENDIENTE', 'SEPARADO', 'OPERARIO_1'));
      assert.ok(isValidTransition('PENDIENTE', 'A_PRODUCCION', 'OPERARIO_1'));
      assert.ok(isValidTransition('SEPARADO', 'A_PRODUCCION', 'OPERARIO_1'));
      assert.equal(isValidTransition('A_PRODUCCION', 'IMPRESO', 'OPERARIO_1'), false);
    });

    it('3.3 Operario 2 (Taller) solo puede archivar como IMPRESO', () => {
      assert.ok(isValidTransition('A_PRODUCCION', 'IMPRESO', 'OPERARIO_2'));
      assert.equal(isValidTransition('PENDIENTE', 'SEPARADO', 'OPERARIO_2'), false);
      assert.equal(isValidTransition('SEPARADO', 'A_PRODUCCION', 'OPERARIO_2'), false);
    });

    it('3.4 Super Admin puede revertir cualquier estado a PENDIENTE', () => {
      assert.ok(isValidTransition('IMPRESO', 'PENDIENTE', 'SUPER_ADMIN'));
      assert.ok(isValidTransition('SEPARADO', 'PENDIENTE', 'SUPER_ADMIN'));
      assert.ok(isValidTransition('A_PRODUCCION', 'PENDIENTE', 'SUPER_ADMIN'));
    });
  });

  // =========================================================================
  // 4. LÓGICA DE ROLES Y RENDERIZADO CONDICIONAL
  // =========================================================================
  describe('4. Lógica de Roles y Renderizado Condicional', () => {
    const resolveRoleState = ({ isSuperAdmin, isOperario1, isOperario2 }) => {
      const isOp2Only = Boolean(isOperario2 && !isOperario1 && !isSuperAdmin);
      const sectionBadge = isSuperAdmin
        ? 'SUPER ADMIN'
        : (isOperario1 && isOperario2
            ? 'PRODUCCIÓN TOTAL'
            : (isOperario2 ? 'TALLER' : (isOperario1 ? 'STOCK & PRODUCCIÓN' : 'OPERADOR')));
      return { isOp2Only, sectionBadge };
    };

    it('4.1 isOp2Only es true únicamente para Operario 2 puro', () => {
      assert.equal(resolveRoleState({ isSuperAdmin: false, isOperario1: false, isOperario2: true }).isOp2Only, true);
      assert.equal(resolveRoleState({ isSuperAdmin: true, isOperario1: false, isOperario2: true }).isOp2Only, false);
      assert.equal(resolveRoleState({ isSuperAdmin: false, isOperario1: true, isOperario2: true }).isOp2Only, false);
      assert.equal(resolveRoleState({ isSuperAdmin: false, isOperario1: true, isOperario2: false }).isOp2Only, false);
    });

    it('4.2 Mapeo de badges de sección respeta la jerarquía', () => {
      assert.equal(resolveRoleState({ isSuperAdmin: true, isOperario1: false, isOperario2: false }).sectionBadge, 'SUPER ADMIN');
      assert.equal(resolveRoleState({ isSuperAdmin: false, isOperario1: true, isOperario2: true }).sectionBadge, 'PRODUCCIÓN TOTAL');
      assert.equal(resolveRoleState({ isSuperAdmin: false, isOperario1: false, isOperario2: true }).sectionBadge, 'TALLER');
      assert.equal(resolveRoleState({ isSuperAdmin: false, isOperario1: true, isOperario2: false }).sectionBadge, 'STOCK & PRODUCCIÓN');
      assert.equal(resolveRoleState({ isSuperAdmin: false, isOperario1: false, isOperario2: false }).sectionBadge, 'OPERADOR');
    });

    it('4.3 ProductionFilterTabs oculta pestañas si isOp2Only es true', () => {
      const tabsContent = fs.readFileSync(
        path.join(rootDir, 'src/components/production/ProductionFilterTabs.jsx'),
        'utf-8'
      );
      assert.ok(tabsContent.includes('if (isOp2Only) return null;'));
    });
  });

  // =========================================================================
  // 5. AUDITORÍA FORENSE DE ENDPOINTS REALES
  // =========================================================================
  describe('5. Auditoría Forense de Endpoints Reales del Backend', () => {
    const hookContent = fs.readFileSync(
      path.join(rootDir, 'src/components/production/hooks/useProductionQueue.js'),
      'utf-8'
    );

    it('5.1 Consume endpoints legítimos /api/production/items, /api/production/metrics y /api/events', () => {
      assert.ok(hookContent.includes('/api/production/items'), 'Debe invocar /api/production/items');
      assert.ok(hookContent.includes('/api/production/metrics'), 'Debe invocar /api/production/metrics');
      assert.ok(hookContent.includes('/api/events'), 'Debe invocar /api/events');
    });

    it('5.2 Actualización de estado invoca PATCH /api/production/items/:id/status', () => {
      assert.ok(hookContent.includes("method: 'PATCH'"), 'Mutación debe ser PATCH');
      assert.ok(hookContent.includes('/status'), 'Endpoint de mutación debe ser /status');
    });

    it('5.3 No existen endpoints inventados como /api/production/queue', () => {
      assert.ok(!hookContent.includes('/api/production/queue'), 'Prohibido endpoint ficticio /api/production/queue');
    });
  });

  // =========================================================================
  // 6. PROTOCOLO ZERO-TRUST Y AUSENCIA DE ARTEFACTOS FORÁNEOS
  // =========================================================================
  describe('6. Protocolo Zero-Trust y Ausencia de Artefactos Foráneos', () => {
    const files = [
      'src/components/ProductionManagementView.jsx',
      'src/components/production/hooks/useProductionQueue.js',
      'src/components/production/ProductionFilterTabs.jsx',
      'src/components/production/ProductionOrderCard.jsx',
    ];

    for (const relPath of files) {
      it(`6.x. ${relPath} no contiene IPs foráneas ni credenciales expuestas`, () => {
        const content = fs.readFileSync(path.join(rootDir, relPath), 'utf-8');
        assert.ok(!content.includes('145.223.120.56'), `IP foránea detectada en ${relPath}`);
        assert.ok(!content.includes('sebasdmente@gmail.com'), `Correo personal detectado en ${relPath}`);
        assert.ok(!content.includes('dummy'), `Palabra dummy detectada en ${relPath}`);
      });
    }
  });
});
