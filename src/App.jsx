import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import LoginView from './components/LoginView';
import FastManualSaleForm from './components/FastManualSaleForm';
import RecentSalesList from './components/RecentSalesList';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const EventsManagementView = lazy(() => import('./components/EventsManagementView'));
const MonitorDashboardView = lazy(() => import('./components/MonitorDashboardView'));
const ProductionManagementView = lazy(() => import('./components/ProductionManagementView'));
const CashClosingView = lazy(() => import('./components/CashClosingView'));
const UserManagementView = lazy(() => import('./components/UserManagementView'));
const CommissionSettlementView = lazy(() => import('./components/CommissionSettlementView'));
const OrderTrackingView = lazy(() => import('./components/OrderTrackingView'));

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

const isOnlinePointOfSale = (ev) => Boolean(
  !ev ||
  ev.id === 'evt-ventas-redes-online' ||
  ev.name?.toLowerCase().includes('redes') ||
  ev.name?.toLowerCase().includes('ventas en línea')
);

const getTodayGuatemalaStr = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());

function SalesTerminalMain() {
  const { user, token, authFetch, isLoading: isAuthLoading, isSuperAdmin, isVendedor, isVendedorRedes, isOperario1, isOperario2, logout } = useAuth();
  const isExclusiveVendedorRedes = Boolean(isVendedorRedes && !isVendedor && !isSuperAdmin);

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
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return parsed;
    } catch (_) {
      return null;
    }
  });

  const [activeEventsList, setActiveEventsList] = useState([]);
  const [unassignedSeller, setUnassignedSeller] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [manualDraft, setManualDraft] = useState(null);
  const [salesRefreshTrigger, setSalesRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      if ((isOperario1 || isOperario2) && !isSuperAdmin && !isVendedor && !isVendedorRedes) {
        setActiveTab('produccion');
      } else if (isVendedor || isVendedorRedes) {
        setActiveTab((prev) => (prev === 'produccion' && !isSuperAdmin ? 'venta' : prev));
      }
    }
  }, [user, isOperario1, isOperario2, isVendedor, isVendedorRedes, isSuperAdmin]);

  const loadInitialData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setUnassignedSeller(false);
      let selectedEvent = null;

      // Cargar lista de eventos activos concurrentes (excluyendo canal digital permanente)
      const eventsRes = await authFetch('/api/events');
      const eventsJson = await eventsRes.json();
      const allActive = eventsJson.success && Array.isArray(eventsJson.data)
        ? eventsJson.data.filter((e) => e.status === 'ACTIVO' && e.id !== 'evt-ventas-redes-online' && !isOnlinePointOfSale(e))
        : [];
      setActiveEventsList(allActive);

      // Evento para VENDEDOR_REDES exclusivo
      if (isExclusiveVendedorRedes) {
        selectedEvent = (eventsJson.success && Array.isArray(eventsJson.data)
          ? eventsJson.data.find((e) => isOnlinePointOfSale(e))
          : null) || null;
      }

      // Si es SUPER_ADMIN, verificar si tiene stand ferial seleccionado en localStorage
      const savedAdminEventId = isSuperAdmin && typeof localStorage !== 'undefined'
        ? localStorage.getItem('deko_admin_selected_event_id')
        : null;

      if (!selectedEvent) {
        const query = savedAdminEventId && savedAdminEventId !== 'evt-ventas-redes-online'
          ? `?eventId=${savedAdminEventId}`
          : '';
        const activeRes = await authFetch(`/api/events/active${query}`);
        const activeJson = await activeRes.json();

        if (activeJson.unassignedSeller) {
          setUnassignedSeller(true);
          setActiveEvent(null);
          setIsLoading(false);
          return;
        }

        if (activeJson.success && activeJson.data) {
          selectedEvent = activeJson.data;
        }
      }

      // Si no es vendedor exclusivo de redes y el evento es digital, descartarlo como stand ferial
      if (!isExclusiveVendedorRedes && isOnlinePointOfSale(selectedEvent)) {
        selectedEvent = allActive[0] || null;
      }

      if (selectedEvent) {
        setActiveEvent(selectedEvent);
        try {
          if (isSuperAdmin && !isOnlinePointOfSale(selectedEvent)) {
            localStorage.setItem('deko_admin_selected_event_id', selectedEvent.id);
          }
          if (isExclusiveVendedorRedes || !isOnlinePointOfSale(selectedEvent)) {
            localStorage.setItem('deko_active_event', JSON.stringify(selectedEvent));
          } else {
            localStorage.removeItem('deko_active_event');
          }
        } catch (_) {}

        if (isSuperAdmin || isVendedor || isVendedorRedes) {
          const todayStr = getTodayGuatemalaStr();
          const metricsRes = await authFetch(`/api/sales/events/${selectedEvent.id}/metrics?date=${todayStr}`);
          const metricsData = await metricsRes.json();
          if (metricsData.success) {
            setLiveMetrics(metricsData.data);
          }
        }
      } else {
        setActiveEvent(null);
        try {
          localStorage.removeItem('deko_active_event');
          if (isSuperAdmin) localStorage.removeItem('deko_admin_selected_event_id');
        } catch (_) {}
      }
    } catch (err) {
      console.error('Error cargando datos iniciales:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, token, isExclusiveVendedorRedes, isVendedor, isSuperAdmin]);

  const refreshMetrics = useCallback(async (override = null) => {
    const targetId = (typeof override === 'object' && override !== null)
      ? (override.eventId || (override.location !== undefined ? override.id : activeEvent?.id))
      : (typeof override === 'string' ? override : activeEvent?.id);
    if (!targetId) return;
    if (!(isSuperAdmin || isVendedor || isVendedorRedes)) return;
    try {
      const todayStr = getTodayGuatemalaStr();
      const metricsRes = await authFetch(`/api/sales/events/${targetId}/metrics?date=${todayStr}`);
      const metricsData = await metricsRes.json();
      if (metricsData.success) {
        setLiveMetrics(metricsData.data);
      }
      setSalesRefreshTrigger((prev) => prev + 1);
    } catch (e) {
      console.error('Error refrescando métricas:', e);
    }
  }, [activeEvent, authFetch, isSuperAdmin, isVendedor, isVendedorRedes]);

  const syncEventsList = useCallback(async (preferredEvent = null) => {
    if (!token) return;
    try {
      const eventsRes = await authFetch('/api/events');
      const eventsJson = await eventsRes.json();
      if (!eventsJson.success || !Array.isArray(eventsJson.data)) return;
      const allActive = eventsJson.data.filter((e) => e.status === 'ACTIVO' && e.id !== 'evt-ventas-redes-online' && !isOnlinePointOfSale(e));
      setActiveEventsList(allActive);

      let nextEvent = preferredEvent;
      if (nextEvent && isOnlinePointOfSale(nextEvent) && !isExclusiveVendedorRedes) {
        nextEvent = null;
      }

      if (!nextEvent) {
        nextEvent = allActive.find((e) => e.id === activeEvent?.id && !isOnlinePointOfSale(e))
          || allActive[0]
          || null;
      }

      setActiveEvent(nextEvent);
      if (nextEvent) {
        try {
          if (isSuperAdmin && !isOnlinePointOfSale(nextEvent)) {
            localStorage.setItem('deko_admin_selected_event_id', nextEvent.id);
          }
          localStorage.setItem('deko_active_event', JSON.stringify(nextEvent));
        } catch (_) {}
        await refreshMetrics(nextEvent);
      }
    } catch (err) {
      console.error('Error sincronizando lista de stands activos:', err);
    }
  }, [token, authFetch, activeEvent?.id, refreshMetrics, isExclusiveVendedorRedes, isSuperAdmin]);

  const handleSelectEvent = useCallback((ev) => {
    if (!ev) return;
    if (!isExclusiveVendedorRedes && isOnlinePointOfSale(ev)) return;
    setActiveEvent(ev);
    try {
      if (isSuperAdmin) {
        localStorage.setItem('deko_admin_selected_event_id', ev.id);
      }
      localStorage.setItem('deko_active_event', JSON.stringify(ev));
    } catch (_) {}
    refreshMetrics(ev);
  }, [refreshMetrics, isSuperAdmin, isExclusiveVendedorRedes]);

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

  if (!user) {
    return <LoginView />;
  }

  // Pantalla informativa si el vendedor presencial no tiene stand asignado
  if (unassignedSeller && isVendedor && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">Sin stand ferial asignado</h2>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Tu cuenta de vendedor está activa, pero ningún administrador te ha asignado a un stand en curso.
          Por favor avisa a tu supervisor para que te vincule al evento ferial correspondiente.
        </p>
        <div className="w-full pt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={loadInitialData}
            className="w-full py-3 px-6 bg-white hover:bg-neutral-200 text-black font-black text-xs rounded-2xl min-h-[44px] flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Verificar asignación</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full py-2.5 px-6 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 text-xs font-semibold rounded-2xl min-h-[44px] cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-neutral-800 selection:text-white">
      <Header
        activeEvent={activeEvent}
        activeEventsList={activeEventsList}
        onSelectEvent={handleSelectEvent}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        liveMetrics={liveMetrics}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-8">
        {(isSuperAdmin || isVendedor || isVendedorRedes) && (
          <div className={activeTab === 'venta' ? 'space-y-6' : 'hidden'}>
            <div id="manual-sale-form-anchor">
              <FastManualSaleForm
                key={activeEvent?.id || 'no-event'}
                eventId={activeEvent?.id}
                onSaleRegistered={refreshMetrics}
                initialDraft={manualDraft}
                onDraftConsumed={() => setManualDraft(null)}
              />
            </div>

            <RecentSalesList
              key={activeEvent?.id || 'no-event'}
              eventId={activeEvent?.id}
              refreshTrigger={salesRefreshTrigger}
              onSaleUpdated={refreshMetrics}
            />
          </div>
        )}

        <Suspense fallback={<ViewLoadingFallback />}>
          {activeTab === 'eventos' && (isSuperAdmin || isVendedorRedes) && (
            <EventsManagementView
              onEventActivated={async (activatedEvent) => {
                await syncEventsList(activatedEvent);
                setActiveTab('venta');
              }}
              onEventsChanged={syncEventsList}
            />
          )}

          {activeTab === 'monitor' && (isSuperAdmin || isVendedor || isVendedorRedes) && (
            <MonitorDashboardView
              activeEvent={activeEvent}
              onPopulateManualForm={(draft) => {
                setManualDraft(draft);
                setActiveTab('venta');
              }}
            />
          )}

          {activeTab === 'produccion' && (isSuperAdmin || isOperario1 || isOperario2 || isVendedorRedes) && (
            <ProductionManagementView />
          )}

          {activeTab === 'seguimiento' && (isSuperAdmin || isVendedor || isVendedorRedes || isOperario1 || isOperario2) && (
            <OrderTrackingView onOrderUpdated={refreshMetrics} />
          )}

          {activeTab === 'cierre' && (isSuperAdmin || isVendedor) && (
            <CashClosingView
              key={activeEvent?.id || 'no-event'}
              liveMetrics={liveMetrics}
              activeEvent={activeEvent}
              onClosingCompleted={refreshMetrics}
            />
          )}

          {activeTab === 'usuarios' && isSuperAdmin && (
            <UserManagementView />
          )}

          {activeTab === 'comisiones' && (isSuperAdmin || isVendedorRedes) && (
            <CommissionSettlementView />
          )}
        </Suspense>
      </main>

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
