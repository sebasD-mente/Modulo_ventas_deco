import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import LoginView from './components/LoginView';
import UnifiedAiChat from './components/UnifiedAiChat';
import FastManualSaleForm from './components/FastManualSaleForm';
import RecentSalesList from './components/RecentSalesList';
import { Loader2 } from 'lucide-react';

// Vistas secundarias cargadas bajo demanda mediante React.lazy()
const EventsManagementView = lazy(() => import('./components/EventsManagementView'));
const MonitorDashboardView = lazy(() => import('./components/MonitorDashboardView'));
const ProductionManagementView = lazy(() => import('./components/ProductionManagementView'));
const CashClosingView = lazy(() => import('./components/CashClosingView'));
const UserManagementView = lazy(() => import('./components/UserManagementView'));
const CommissionSettlementView = lazy(() => import('./components/CommissionSettlementView'));

// Componente de espera elegante mientras se descarga el chunk
function ViewLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-white animate-pulse">
      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
      <div className="text-xs font-bold tracking-widest uppercase text-neutral-400">
        STAND {'{IA}'} • Cargando módulo...
      </div>
    </div>
  );
}

function SalesTerminalMain() {
  const { user, token, authFetch, isLoading: isAuthLoading, isSuperAdmin, isVendedor, isVendedorRedes, isOperario1, isOperario2 } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const savedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('deko_auth_user') : null;
      if (savedUser) {
        const u = JSON.parse(savedUser);
        const userRoles = Array.isArray(u?.roles) && u.roles.length > 0
          ? u.roles
          : (u?.role ? [u.role] : []);
        const isSuper = userRoles.includes('SUPER_ADMIN');
        const isVend = userRoles.includes('VENDEDOR');
        const isVendRedes = userRoles.includes('VENDEDOR_REDES');
        const isOp = userRoles.includes('OPERARIO_1') || userRoles.includes('OPERARIO_2');

        if (isOp && !isSuper && !isVend && !isVendRedes) {
          return 'produccion';
        }
      }
    } catch (_) {}
    return 'venta';
  });
  const [activeEvent, setActiveEvent] = useState(() => {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('deko_active_event') : null;
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [manualDraft, setManualDraft] = useState(null);
  const [salesRefreshTrigger, setSalesRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Ajustar pestaña por defecto según rol
  useEffect(() => {
    if (user) {
      if ((isOperario1 || isOperario2) && !isSuperAdmin && !isVendedor && !isVendedorRedes) {
        setActiveTab('produccion');
      } else if (isVendedor || isVendedorRedes) {
        setActiveTab((prev) => (prev === 'produccion' && !isSuperAdmin ? 'venta' : prev));
      }
    }
  }, [user, isOperario1, isOperario2, isVendedor, isVendedorRedes, isSuperAdmin]);

  // Cargar datos iniciales del evento activo y métricas
  const loadInitialData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      let selectedEvent = null;

      // Evento activo para VENDEDOR_REDES (si no es vendedor de feria ni super admin)
      if (isVendedorRedes && !isVendedor && !isSuperAdmin) {
        const eventsRes = await authFetch('/api/events');
        const eventsData = await eventsRes.json();
        if (eventsData.success && Array.isArray(eventsData.data) && eventsData.data.length > 0) {
          selectedEvent =
            eventsData.data.find(
              (e) => e.id === 'evt-ventas-redes-online' || e.name?.toLowerCase().includes('redes')
            ) || eventsData.data[0];
        }
      }

      // Si no es vendedor de redes exclusivo, o si no se encontró evento de redes, consultar evento activo
      if (!selectedEvent) {
        const eventRes = await authFetch('/api/events/active');
        const eventData = await eventRes.json();
        if (eventData.success && eventData.data) {
          selectedEvent = eventData.data;
        }
      }

      if (selectedEvent) {
        setActiveEvent(selectedEvent);
        try {
          localStorage.setItem('deko_active_event', JSON.stringify(selectedEvent));
        } catch (_) {}

        // 2. Métricas selectivas: Solo invocar si es SUPER_ADMIN, VENDEDOR o VENDEDOR_REDES
        if (isSuperAdmin || isVendedor || isVendedorRedes) {
          const metricsRes = await authFetch(`/api/sales/events/${selectedEvent.id}/metrics`);
          const metricsData = await metricsRes.json();
          if (metricsData.success) {
            setLiveMetrics(metricsData.data);
          }
        }
      }
    } catch (err) {
      console.error('Error cargando datos iniciales:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, token, isVendedorRedes, isVendedor, isSuperAdmin]);

  const refreshMetrics = useCallback(async () => {
    if (!activeEvent) return;
    if (!(isSuperAdmin || isVendedor || isVendedorRedes)) return;
    try {
      const metricsRes = await authFetch(`/api/sales/events/${activeEvent.id}/metrics`);
      const metricsData = await metricsRes.json();
      if (metricsData.success) {
        setLiveMetrics(metricsData.data);
      }
      setSalesRefreshTrigger((prev) => prev + 1);
    } catch (e) {
      console.error('Error refrescando métricas:', e);
    }
  }, [activeEvent, authFetch, isSuperAdmin, isVendedor, isVendedorRedes]);

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user, loadInitialData]);

  if (isAuthLoading && !user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
        <div className="text-xs font-bold tracking-widest uppercase text-neutral-400">
          STAND {'{IA}'} • Verificando Sesión Segura...
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado (ni en caché local), renderizar pantalla de Login Oficial de Google
  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-neutral-800 selection:text-white">
      {/* Header Superior Blanco con STAND {IA} y Perfil de Usuario */}
      <Header
        activeEvent={activeEvent}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        liveMetrics={liveMetrics}
      />

      {/* Contenedor Principal Centrado */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-8">
        {/* PÁGINA 1: NUEVA VENTA (TERMINAL DE ALTA VELOCIDAD) */}
        {activeTab === 'venta' && (isSuperAdmin || isVendedor || isVendedorRedes) && (
          <div className="space-y-6">
            <UnifiedAiChat
              eventId={activeEvent?.id}
              onSaleRegistered={refreshMetrics}
              onPopulateManualForm={(draft) => {
                setManualDraft(draft);
                window.scrollTo({ top: 380, behavior: 'smooth' });
              }}
            />

            <FastManualSaleForm
              eventId={activeEvent?.id}
              onSaleRegistered={refreshMetrics}
              initialDraft={manualDraft}
            />

            <RecentSalesList
              eventId={activeEvent?.id}
              refreshTrigger={salesRefreshTrigger}
              onSaleUpdated={refreshMetrics}
            />
          </div>
        )}

        {/* VISTAS SECUNDARIAS ASÍNCRONAS CON CARGA BAJO DEMANDA */}
        <Suspense fallback={<ViewLoadingFallback />}>
          {/* PÁGINA 2: GESTIÓN DE EVENTOS (SUPER ADMIN, VENDEDOR REDES) */}
          {activeTab === 'eventos' && (isSuperAdmin || isVendedorRedes) && (
            <EventsManagementView
              onEventActivated={(activatedEvent) => {
                setActiveEvent(activatedEvent);
                refreshMetrics();
                setActiveTab('venta');
              }}
            />
          )}

          {/* PÁGINA 3: MONITOR EN TIEMPO REAL */}
          {activeTab === 'monitor' && (isSuperAdmin || isVendedor || isVendedorRedes) && (
            <MonitorDashboardView />
          )}

          {/* PÁGINA 4: GESTIÓN DE PRODUCCIÓN Y TALLER (OPERARIO 1, OPERARIO 2, SUPER ADMIN, VENDEDOR REDES) */}
          {activeTab === 'produccion' && (isSuperAdmin || isOperario1 || isOperario2 || isVendedorRedes) && (
            <ProductionManagementView />
          )}

          {/* PÁGINA 5: CIERRE DE CAJA Y ARQUEO */}
          {activeTab === 'cierre' && (isSuperAdmin || isVendedor) && (
            <CashClosingView
              liveMetrics={liveMetrics}
              activeEvent={activeEvent}
              onClosingCompleted={refreshMetrics}
            />
          )}

          {/* PÁGINA 6: GESTIÓN DE USUARIOS Y ROLES (SUPER ADMIN) */}
          {activeTab === 'usuarios' && isSuperAdmin && (
            <UserManagementView />
          )}

          {/* PÁGINA 7: COMISIONES Y LIQUIDACIONES (SUPER ADMIN, VENDEDOR REDES) */}
          {activeTab === 'comisiones' && (isSuperAdmin || isVendedorRedes) && (
            <CommissionSettlementView />
          )}
        </Suspense>
      </main>

      {/* Footer Discreto */}
      <footer className="border-t border-neutral-900 py-4 px-6 text-center text-xs text-neutral-500">
        STAND {'{IA}'} SaaS • Desarrollado por <strong>Deko Labs</strong> para <strong>Deco Vintage Guate</strong> • PostgreSQL VPS Inmutable
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SalesTerminalMain />
    </AuthProvider>
  );
}
