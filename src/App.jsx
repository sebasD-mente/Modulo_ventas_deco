import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import LoginView from './components/LoginView';
import UnifiedAiChat from './components/UnifiedAiChat';
import FastManualSaleForm from './components/FastManualSaleForm';
import RecentSalesList from './components/RecentSalesList';
import EventsManagementView from './components/EventsManagementView';
import MonitorDashboardView from './components/MonitorDashboardView';
import CashClosingView from './components/CashClosingView';
import ProductionManagementView from './components/ProductionManagementView';
import UserManagementView from './components/UserManagementView';
import { Loader2 } from 'lucide-react';

function SalesTerminalMain() {
  const { user, token, authFetch, isLoading: isAuthLoading, isSuperAdmin, isVendedor, isOperario1, isOperario2 } = useAuth();
  const [activeTab, setActiveTab] = useState('venta');
  const [activeEvent, setActiveEvent] = useState(null);
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [manualDraft, setManualDraft] = useState(null);
  const [salesRefreshTrigger, setSalesRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Ajustar pestaña por defecto según rol
  useEffect(() => {
    if (user) {
      if (isOperario1 || isOperario2) {
        setActiveTab('produccion');
      } else if (isVendedor) {
        setActiveTab('venta');
      }
    }
  }, [user, isOperario1, isOperario2, isVendedor]);

  // Cargar datos iniciales del evento activo y métricas
  const loadInitialData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      // 1. Evento Activo
      const eventRes = await authFetch('/api/events/active');
      const eventData = await eventRes.json();
      if (eventData.success && eventData.data) {
        setActiveEvent(eventData.data);

        // 2. Métricas en vivo del evento activo
        const metricsRes = await authFetch(`/api/sales/events/${eventData.data.id}/metrics`);
        const metricsData = await metricsRes.json();
        if (metricsData.success) {
          setLiveMetrics(metricsData.data);
        }
      }
    } catch (err) {
      console.error('Error cargando datos iniciales:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, token]);

  const refreshMetrics = async () => {
    if (!activeEvent) return;
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
  };

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user, loadInitialData]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
        <div className="text-xs font-bold tracking-widest uppercase text-neutral-400">
          STAND {'{IA}'} • Verificando Sesión Segura...
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado, renderizar pantalla de Login Oficial de Google
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
        {activeTab === 'venta' && (isSuperAdmin || isVendedor) && (
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

        {/* PÁGINA 2: GESTIÓN DE EVENTOS (SUPER ADMIN) */}
        {activeTab === 'eventos' && isSuperAdmin && (
          <EventsManagementView
            onEventActivated={(activatedEvent) => {
              setActiveEvent(activatedEvent);
              refreshMetrics();
              setActiveTab('venta');
            }}
          />
        )}

        {/* PÁGINA 3: MONITOR EN TIEMPO REAL */}
        {activeTab === 'monitor' && (isSuperAdmin || isVendedor) && (
          <MonitorDashboardView />
        )}

        {/* PÁGINA 4: GESTIÓN DE PRODUCCIÓN Y TALLER (OPERARIO 1, OPERARIO 2, SUPER ADMIN) */}
        {activeTab === 'produccion' && (isSuperAdmin || isOperario1 || isOperario2) && (
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
