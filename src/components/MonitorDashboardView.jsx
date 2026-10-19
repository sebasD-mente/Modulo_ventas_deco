import React, { useState } from 'react';
import { RotateCcw, Calendar, Loader2, Tv, TrendingUp, Target, DollarSign, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useMonitorDashboard from './monitor/hooks/useMonitorDashboard';
import MonitorKpiGrid from './monitor/MonitorKpiGrid';
import PaymentMethodsBreakdown from './monitor/PaymentMethodsBreakdown';
import EventsPerformanceList from './monitor/EventsPerformanceList';
import EventFinancialRadar from './monitor/EventFinancialRadar';
import EventExpensesModal from './events/modals/EventExpensesModal';
import UnifiedAiChat from './UnifiedAiChat';

export default function MonitorDashboardView() {
  const { isSuperAdmin } = useAuth();
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [eventForExpenses, setEventForExpenses] = useState(null);
  const {
    selectedDate, setSelectedDate, monitorData, isLoading,
    isRefreshing, lastSyncTime, expandedEvents, toggleEvent, fetchMonitorData,
  } = useMonitorDashboard();

  if (isLoading && !monitorData) {
    return (
      <div className="bg-[#121212] p-8 sm:p-12 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl flex flex-col items-center justify-center text-white max-w-2xl mx-auto space-y-3">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
        <span className="text-xs font-bold tracking-wider uppercase text-neutral-400">Sincronizando monitor de ventas en vivo...</span>
      </div>
    );
  }

  const { eventDetails = [], resumenGeneral = {} } = monitorData || {};

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl space-y-6 text-white max-w-2xl mx-auto">
      {/* 1. ENCABEZADO Y ESTADO EN VIVO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white text-black flex items-center justify-center text-lg font-black shadow-sm select-none"><Tv className="w-5 h-5" /></div>
          <div><h3 className="text-sm sm:text-base font-bold text-white">Monitor de ventas</h3><p className="text-xs text-neutral-400">Rendimiento y transacciones de stands en tiempo real</p></div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500 bg-white text-emerald-600 font-extrabold text-xs shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span>EN VIVO</span>
          </div>
          <span className="text-[11px] text-neutral-400 font-mono">{lastSyncTime}</span>
        </div>
      </div>

      {/* 2. BARRA DE CONTROL */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-black border border-neutral-800">
        <div className="flex items-center gap-2 flex-1">
          <Calendar className="w-4 h-4 text-neutral-400 shrink-0" /><span className="text-xs font-bold text-neutral-300 shrink-0">Fecha:</span>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-[#181818] border border-neutral-700/90 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white w-full max-w-[200px]" />
        </div>
        <button type="button" onClick={() => fetchMonitorData(true)} disabled={isRefreshing} className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95 cursor-pointer">
          <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /><span>Actualizar</span>
        </button>
      </div>
 
      {/* 2.1. COPILOTO GERENCIAL & AUDITORÍA IA (EXCLUSIVO SUPER_ADMIN) */}
      {isSuperAdmin && (
        <div className="rounded-2xl bg-neutral-950 border border-neutral-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsCopilotOpen((prev) => !prev)}
            aria-expanded={isCopilotOpen}
            className="w-full min-h-[44px] p-4 flex items-center justify-between gap-3 text-left hover:bg-neutral-900/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs sm:text-sm text-white block">
                  🧠 Copiloto Gerencial & Auditoría IA
                </span>
                <span className="text-[11px] text-neutral-400 block">
                  Consultas de caja en vivo, corte de turno por vendedor, KPIs y pruebas multimodales
                </span>
              </div>
            </div>
            <div className="text-neutral-400 shrink-0">
              {isCopilotOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </button>

          {isCopilotOpen && (
            <div className="p-4 border-t border-neutral-800 bg-black/40">
              <UnifiedAiChat
                eventId={eventDetails[0]?.event?.id}
                eventName={eventDetails[0]?.event?.name || 'Monitor Global'}
                onSaleRegistered={() => fetchMonitorData(true)}
              />
            </div>
          )}
        </div>
      )}

      {/* 3. RADAR FINANCIERO FERIAL (REGLA DEL 20%) */}
      <EventFinancialRadar
        eventDetails={eventDetails}
        globalFinancials={resumenGeneral?.globalFinancials}
        isSuperAdmin={isSuperAdmin}
        onOpenExpenseModal={(ev) => setEventForExpenses(ev)}
      />

      {/* 4. DETALLE POR EVENTO */}
      <EventsPerformanceList eventDetails={eventDetails} expandedEvents={expandedEvents} onToggleEvent={toggleEvent} selectedDate={selectedDate} />

      {eventForExpenses && (
        <EventExpensesModal
          isOpen={Boolean(eventForExpenses)}
          event={eventForExpenses}
          onClose={() => setEventForExpenses(null)}
          onExpensesUpdated={() => fetchMonitorData(true)}
        />
      )}

      {/* 4. RESUMEN GENERAL DE LA JORNADA (Solo visible para Super Admin o cuando hay múltiples stands) */}
      {(isSuperAdmin || eventDetails.length > 1) && (
        <div className="space-y-4 pt-4 border-t border-neutral-800">
          <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>🏆</span> Resumen general de la jornada
          </label>
          <MonitorKpiGrid mode="general" transactions={resumenGeneral.totalTransactions} totalSold={resumenGeneral.totalSold} />
          <PaymentMethodsBreakdown payments={resumenGeneral.payments} chartSize={250} variant="general" />
        </div>
      )}
    </div>
  );
}
