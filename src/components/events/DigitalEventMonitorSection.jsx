import React, { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Calendar, Loader2, Tv } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import MonitorKpiGrid from '../monitor/MonitorKpiGrid';
import PaymentMethodsBreakdown from '../monitor/PaymentMethodsBreakdown';

const getGuatemalaDateStr = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
};

const getGuatemalaTimeStr = () => {
  return new Date().toLocaleTimeString('es-GT', {
    timeZone: 'America/Guatemala',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export default function DigitalEventMonitorSection({ eventId }) {
  const { authFetch } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getGuatemalaDateStr());
  const [monitorData, setMonitorData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(getGuatemalaTimeStr());

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await authFetch(`/api/sales/monitor?date=${selectedDate}&eventId=${eventId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setMonitorData(json.data);
        setLastSyncTime(getGuatemalaTimeStr());
      }
    } catch (err) {
      console.error('Error cargando métricas del canal digital:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authFetch, selectedDate, eventId]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => {
      fetchData();
    }, 15000);
    return () => clearInterval(timer);
  }, [fetchData]);

  if (isLoading && !monitorData) {
    return (
      <div className="py-10 text-center flex flex-col items-center justify-center space-y-2">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        <span className="text-xs text-neutral-400 font-medium">Cargando métricas del canal digital...</span>
      </div>
    );
  }

  const eventDetail = monitorData?.eventDetails?.find((e) => e.eventId === eventId) || monitorData?.eventDetails?.[0];
  const hasTransactions = Boolean(eventDetail && eventDetail.transactions > 0);

  return (
    <div className="space-y-4 pt-3 select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-800/80">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-bold text-white">📺 Rendimiento en Vivo</h4>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-500 bg-white text-emerald-600 font-extrabold text-[10px] shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>🟢 EN VIVO</span>
          </div>
          <span className="text-[11px] text-neutral-400 font-mono">{lastSyncTime}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800">
        <div className="flex items-center gap-2 flex-1">
          <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
          <span className="text-xs font-bold text-neutral-300 shrink-0">Fecha:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-black border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400 w-full max-w-[180px] min-h-[44px]"
          />
        </div>
        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {hasTransactions ? (
        <div className="space-y-4">
          <MonitorKpiGrid
            mode="event"
            transactions={eventDetail.transactions}
            totalSold={eventDetail.totalSold}
            lastSale={eventDetail.lastSale}
          />
          <PaymentMethodsBreakdown
            payments={eventDetail.payments}
            chartSize={230}
            variant="event"
          />
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-black border border-neutral-800 text-center text-xs text-neutral-400">
          No hay ventas registradas en el canal digital para la fecha seleccionada.
        </div>
      )}
    </div>
  );
}
