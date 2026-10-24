import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('⚔️ CIRUGÍA [DEKO-STANDIA-065]: Densidad Espacial en Tarjetas de Eventos, Rediseño de Redes Sociales y Navegación SPA Atrás', () => {
  // =========================================================================
  // 1. EventCard.jsx — Optimización Espacial y Cinta Unificada de 4 Métricas
  // =========================================================================
  describe('1. EventCard.jsx: Densidad Espacial, Vendedores en 1 Línea y Cinta de 4 Métricas', () => {
    it('1.1: EventCard.jsx define UnifiedMetricsStrip con grid-cols-2 sm:grid-cols-4 y preserva contratos legacy', () => {
      const cardCode = fs.readFileSync(path.join(ROOT, 'src/components/events/EventCard.jsx'), 'utf-8');

      assert.ok(cardCode.includes('function UnifiedMetricsStrip'), 'EventCard.jsx debe incluir UnifiedMetricsStrip');
      assert.ok(cardCode.includes('grid-cols-2 sm:grid-cols-4'), 'Debe consolidar las 4 métricas en grid-cols-2 sm:grid-cols-4');
      assert.ok(!cardCode.includes('function FinancialsBadgeSection'), 'Debe erradicar el bloque duplicado FinancialsBadgeSection');

      // SellersSection en una fila horizontal compacta
      assert.ok(
        cardCode.includes('flex items-center justify-between gap-2 text-xs'),
        'SellersSection debe disponerse en una fila horizontal compacta'
      );

      // Preservar contratos de surgery-053
      assert.ok(
        cardCode.includes('const hasRelationalArray = Array.isArray(event.assignedSellers);'),
        'Debe preservar const hasRelationalArray = Array.isArray(event.assignedSellers);'
      );
      assert.ok(
        cardCode.includes('!hasRelationalArray && (event.assignedSellerName || event.assignedSellerEmail)'),
        'Debe preservar !hasRelationalArray && (event.assignedSellerName || event.assignedSellerEmail)'
      );
    });
  });

  // =========================================================================
  // 2. useEventsManager.js — Eventos Archivados Contraídos por Defecto
  // =========================================================================
  describe('2. useEventsManager.js: Pestaña de Eventos Archivados Contraída por Defecto', () => {
    it('2.1: showArchivedSection se inicializa en useState(false)', () => {
      const hookCode = fs.readFileSync(path.join(ROOT, 'src/components/events/hooks/useEventsManager.js'), 'utf-8');

      assert.ok(
        hookCode.includes('[showArchivedSection, setShowArchivedSection] = useState(false)'),
        'showArchivedSection debe inicializarse estrictamente en useState(false)'
      );
      assert.ok(
        !hookCode.includes('[showArchivedSection, setShowArchivedSection] = useState(true)'),
        'PROHIBIDO inicializar showArchivedSection en useState(true)'
      );
    });
  });

  // =========================================================================
  // 3. EventsFilterBar.jsx — Botón "Nuevo evento" Equilibrado
  // =========================================================================
  describe('3. EventsFilterBar.jsx: Botón "Nuevo evento" sin Deformación ni Salto de Línea', () => {
    it('3.1: El botón Nuevo evento incluye shrink-0 whitespace-nowrap y min-h-[44px]', () => {
      const filterCode = fs.readFileSync(path.join(ROOT, 'src/components/events/EventsFilterBar.jsx'), 'utf-8');

      assert.ok(filterCode.includes('data-testid="create-event-btn"'), 'Debe incluir data-testid="create-event-btn"');
      assert.ok(filterCode.includes('shrink-0 whitespace-nowrap min-h-[44px]'), 'El botón debe tener shrink-0 whitespace-nowrap min-h-[44px]');
      assert.ok(filterCode.includes('className="min-w-0"'), 'El contenedor del título izquierdo debe tener min-w-0');
    });
  });

  // =========================================================================
  // 4. EventsManagementView.jsx — Tarjeta de Redes Sociales Equilibrada sin Morado
  // =========================================================================
  describe('4. EventsManagementView.jsx: Tarjeta de Redes Sociales Sobria, Centrada y sin Asignación Manual', () => {
    it('4.1: Elimina Asignar Vendedores de Redes y bg-purple-600, centra métricas y usa botón blanco', () => {
      const viewCode = fs.readFileSync(path.join(ROOT, 'src/components/EventsManagementView.jsx'), 'utf-8');

      assert.ok(!viewCode.includes('Asignar Vendedores de Redes'), 'PROHIBIDO mostrar botón Asignar Vendedores de Redes en tarjeta de Redes');
      assert.ok(!viewCode.includes('bg-purple-600'), 'PROHIBIDO usar bg-purple-600 en el botón Ver Ventas');
      assert.ok(!viewCode.includes('border-purple-900'), 'PROHIBIDO usar bordes morados en la tarjeta de Redes');

      // Preservar contratos previos (surgery-056 y surgery-058)
      assert.ok(viewCode.includes('data-testid="permanent-digital-pos-card"'), 'Debe mantener data-testid="permanent-digital-pos-card"');
      assert.ok(viewCode.includes('Punto de Venta Permanente (Activo 24/7)'), 'Debe mantener Punto de Venta Permanente (Activo 24/7)');
      assert.ok(viewCode.includes('Acumulado Histórico'), 'Debe mantener Acumulado Histórico');

      // Centrado simétrico de Acumulado Histórico y Órdenes + botón de archivados
      assert.ok(
        viewCode.includes('text-center flex flex-col items-center justify-center'),
        'Las cajas de Acumulado Histórico y Órdenes deben estar centradas simétricamente'
      );
      assert.ok(
        viewCode.includes('data-testid="toggle-archived-events-btn"'),
        'La pestaña de Eventos Archivados debe ser un botón interactivo con data-testid="toggle-archived-events-btn"'
      );
    });
  });

  // =========================================================================
  // 5. useSpaBackNavigation.js — Guardia de Navegación SPA y Modales
  // =========================================================================
  describe('5. useSpaBackNavigation.js: Interceptación del Botón Atrás en Modales y Pestañas', () => {
    it('5.1: useSpaBackNavigation.js exporta useModalBackHandler y useSpaBackNavigation con centinela popstate', () => {
      const navCode = fs.readFileSync(path.join(ROOT, 'src/hooks/useSpaBackNavigation.js'), 'utf-8');

      assert.ok(navCode.includes('export function useModalBackHandler'), 'Debe exportar useModalBackHandler');
      assert.ok(navCode.includes('export function useSpaBackNavigation'), 'Debe exportar useSpaBackNavigation');
      assert.ok(navCode.includes('window.history.pushState({ dekoGuard: true'), 'Debe empujar estado centinela dekoGuard en window.history');
      assert.ok(navCode.includes("window.addEventListener('popstate', handlePopState)"), 'Debe escuchar el evento popstate');
      assert.ok(navCode.includes('modalClosersStack'), 'Debe gestionar pila LIFO de modales abiertos');
    });

    it('5.2: App.jsx y los 7 modales principales integran la guardia de navegación hacia atrás', () => {
      const appCode = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf-8');
      assert.ok(appCode.includes('useSpaBackNavigation'), 'App.jsx debe invocar useSpaBackNavigation');

      const modalFiles = [
        'src/components/EditSaleModal.jsx',
        'src/components/events/modals/EventSalesModal.jsx',
        'src/components/events/modals/EventExpensesModal.jsx',
        'src/components/events/modals/CreateEventModal.jsx',
        'src/components/events/modals/EditEventModal.jsx',
        'src/components/events/modals/EventActionModals.jsx',
        'src/components/sales/BalancePaymentModal.jsx',
      ];

      for (const relPath of modalFiles) {
        const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
        assert.ok(
          content.includes('useModalBackHandler'),
          `El modal ${relPath} debe registrar useModalBackHandler para cerrarse con el botón Atrás`
        );
      }
    });
  });
});
