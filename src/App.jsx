import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import UnifiedAiChat from './components/UnifiedAiChat';
import FastManualSaleForm from './components/FastManualSaleForm';
import RecentSalesList from './components/RecentSalesList';
import EventsManagementView from './components/EventsManagementView';
import MonitorDashboardView from './components/MonitorDashboardView';
import CashClosingView from './components/CashClosingView';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('venta'); // 'venta' | 'eventos' | 'cierre'
  const [activeEvent, setActiveEvent] = useState(null);
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [manualDraft, setManualDraft] = useState(null);
  const [salesRefreshTrigger, setSalesRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar datos iniciales
  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      // 1. Evento Activo
      const eventRes = await fetch('/api/events/active');
      const eventData = await eventRes.json();
      if (eventData.success && eventData.data) {
        setActiveEvent(eventData.data);

        // 2. Métricas en vivo del evento activo
        const metricsRes = await fetch(`/api/sales/events/${eventData.data.id}/metrics`);
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
  };

  // Recargar métricas tras una venta o cierre
  const refreshMetrics = async () => {
    if (!activeEvent) return;
    try {
      const metricsRes = await fetch(`/api/sales/events/${activeEvent.id}/metrics`);
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
    loadInitialData();
  }, []);

  if (isLoading && !activeEvent) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-3" />
        <div className="text-sm font-bold tracking-wider uppercase text-amber-400">
          Deko EventSales • Deco Vintage Guate
        </div>
        <div className="text-xs text-slate-400 mt-1">Conectando con base de datos PostgreSQL VPS...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Superior con Métricas y Navegación Principal */}
      <Header
        activeEvent={activeEvent}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        liveMetrics={liveMetrics}
      />

      {/* Contenedor Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* PÁGINA 1: NUEVA VENTA (TERMINAL DE ALTA VELOCIDAD) */}
        {activeTab === 'venta' && (
          <div className="space-y-6">
            {/* PARTE SUPERIOR: Chat con el Agente de IA Unificado (Audio, Cámara y Texto) */}
            <UnifiedAiChat
              eventId={activeEvent?.id}
              onSaleRegistered={refreshMetrics}
              onPopulateManualForm={(draft) => {
                setManualDraft(draft);
                // Desplazar suavemente hacia el formulario manual
                window.scrollTo({ top: 380, behavior: 'smooth' });
              }}
            />

            {/* PARTE INFERIOR (SCROLL): Formulario de Venta Manual Ágil con Catálogo Web */}
            <FastManualSaleForm
              eventId={activeEvent?.id}
              onSaleRegistered={refreshMetrics}
              initialDraft={manualDraft}
            />

            {/* LISTA DE VENTAS RECIENTES DEL EVENTO & EDICIÓN RÁPIDA */}
            <RecentSalesList
              eventId={activeEvent?.id}
              refreshTrigger={salesRefreshTrigger}
              onSaleUpdated={refreshMetrics}
            />
          </div>
        )}

        {/* PÁGINA 2: GESTIÓN DE EVENTOS Y CONSULTA DE VENTAS */}
        {activeTab === 'eventos' && (
          <EventsManagementView
            onEventActivated={(activatedEvent) => {
              setActiveEvent(activatedEvent);
              refreshMetrics();
              setActiveTab('venta'); // Redirigir a la venta con el nuevo evento activo
            }}
          />
        )}

        {/* PÁGINA: MONITOR DE VENTAS EN TIEMPO REAL PARA GERENCIA */}
        {activeTab === 'monitor' && (
          <MonitorDashboardView />
        )}

        {/* PÁGINA 3 (UTILIDAD): CIERRE DE CAJA Y ARQUEO */}
        {activeTab === 'cierre' && (
          <CashClosingView
            liveMetrics={liveMetrics}
            activeEvent={activeEvent}
            onClosingCompleted={refreshMetrics}
          />
        )}
      </main>

      {/* Footer Discreto */}
      <footer className="border-t border-slate-800/60 py-4 px-6 text-center text-xs text-slate-500">
        Deko EventSales SaaS • Desarrollado por <strong>Deko Labs</strong> para <strong>Deco Vintage Guate</strong> • PostgreSQL VPS Inmutable
      </footer>
    </div>
  );
}
