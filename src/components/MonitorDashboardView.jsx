import React from 'react';
import { RotateCcw, Calendar, Loader2, Tv, TrendingUp, Target, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useMonitorDashboard from './monitor/hooks/useMonitorDashboard';
import MonitorKpiGrid from './monitor/MonitorKpiGrid';
import PaymentMethodsBreakdown from './monitor/PaymentMethodsBreakdown';
import EventsPerformanceList from './monitor/EventsPerformanceList';

export default function MonitorDashboardView() {
  const { isSuperAdmin } = useAuth();
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

      {/* 3. RADAR DE PUNTO DE EQUILIBRIO Y RENTABILIDAD FERIAL */}
      {(() => {
        const totalGross = Number(resumenGeneral.totalSold || 0);
        const primaryEv = eventDetails[0]?.event || {};
        const standFixedCost = Number(primaryEv.budget || primaryEv.standCost || 2500);
        const estimatedProdCost = totalGross * 0.30;
        const totalCosts = standFixedCost + estimatedProdCost;
        const netProfit = totalGross - totalCosts;
        const breakEvenTarget = standFixedCost / 0.70;
        const breakEvenProgress = totalGross > 0 ? Math.min(100, Math.round((totalGross / breakEvenTarget) * 100)) : 0;

        return (
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3.5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
              <span className="font-bold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-amber-400" />
                <span>Radar de Punto de Equilibrio (Break-Even)</span>
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg border ${
                netProfit >= 0 ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400' : 'bg-amber-950/60 border-amber-800 text-amber-400'
              }`}>
                {breakEvenProgress}% Cubierto
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-black border border-neutral-800">
                <span className="text-[10px] text-neutral-400 block font-medium">Venta Bruta</span>
                <span className="text-xs sm:text-sm font-black font-mono text-white">Q {totalGross.toFixed(2)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black border border-neutral-800">
                <span className="text-[10px] text-neutral-400 block font-medium">Costos Totales</span>
                <span className="text-xs sm:text-sm font-black font-mono text-neutral-300">Q {totalCosts.toFixed(2)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black border border-neutral-800">
                <span className="text-[10px] text-neutral-400 block font-medium">Utilidad Neta Real</span>
                <span className={`text-xs sm:text-sm font-black font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {netProfit >= 0 ? `+Q ${netProfit.toFixed(2)}` : `-Q ${Math.abs(netProfit).toFixed(2)}`}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
                <div
                  className={`h-full transition-all duration-500 ${netProfit >= 0 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  style={{ width: `${breakEvenProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>Meta Break-Even: Q {breakEvenTarget.toFixed(2)}</span>
                <span className={netProfit >= 0 ? 'text-emerald-400 font-bold' : 'text-amber-300'}>
                  {netProfit >= 0 ? '🎉 Stand en zona de ganancia neta' : `Faltan Q ${Math.max(0, breakEvenTarget - totalGross).toFixed(2)} para equilibrio`}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4. DETALLE POR EVENTO */}
      <EventsPerformanceList eventDetails={eventDetails} expandedEvents={expandedEvents} onToggleEvent={toggleEvent} selectedDate={selectedDate} />

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
