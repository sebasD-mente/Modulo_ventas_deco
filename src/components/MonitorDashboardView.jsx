import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  Calendar,
  CreditCard,
  Smartphone,
  Banknote,
  Receipt,
  ChevronDown,
  ChevronUp,
  Loader2,
  Tv,
} from 'lucide-react';
import DonutChart from './DonutChart.jsx';

export default function MonitorDashboardView() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [monitorData, setMonitorData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(
    new Date().toLocaleTimeString()
  );
  const [expandedEvents, setExpandedEvents] = useState({});
  const pollingRef = useRef(null);

  const fetchMonitorData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/sales/monitor?date=${selectedDate}`);
      const json = await res.json();
      if (json.success && json.data) {
        setMonitorData(json.data);
        setLastSyncTime(new Date().toLocaleTimeString());

        // Por defecto abrir el primer evento o todos
        setExpandedEvents((prev) => {
          if (Object.keys(prev).length === 0 && json.data.eventDetails?.length > 0) {
            const initial = {};
            json.data.eventDetails.forEach((ev) => {
              initial[ev.eventId] = true;
            });
            return initial;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Error cargando métricas del monitor:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Carga inicial y auto-refresco en vivo cada 5 segundos
  useEffect(() => {
    fetchMonitorData();

    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      fetchMonitorData();
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedDate]);

  const toggleEvent = (eventId) => {
    setExpandedEvents((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  };

  if (isLoading && !monitorData) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-xs font-bold tracking-wider uppercase">
          Sincronizando Monitor de Ventas en Vivo...
        </span>
      </div>
    );
  }

  const { eventDetails = [], resumenGeneral = {} } = monitorData || {};

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. BARRA SUPERIOR DE CONTROL: Fecha y Actualizar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
            <span>🗓️</span> Fecha a consultar:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500 w-full"
          />
        </div>

        <button
          type="button"
          onClick={() => fetchMonitorData(true)}
          disabled={isRefreshing}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* 2. TÍTULO PRINCIPAL Y ESTADO EN VIVO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xl shadow-md">
            📺
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-100 tracking-tight">
              Monitor Ventas Stand
            </h2>
            <p className="text-xs text-slate-400">
              Consulta el rendimiento de ventas en tiempo real.
            </p>
          </div>
        </div>

        {/* Badge EN VIVO con hora idéntica al screenshot */}
        <div className="text-left sm:text-right">
          <span className="text-[10px] text-slate-500 block">Última actualización:</span>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-emerald-500/40 text-emerald-300 font-mono text-xs shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-extrabold uppercase tracking-wider text-[11px]">EN VIVO</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-bold">{lastSyncTime}</span>
          </div>
        </div>
      </div>

      {/* 3. SECCIÓN: 🎪 DETALLE POR EVENTO */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-base">🎪</span>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-100">
            Detalle por Evento
          </h3>
        </div>

        {eventDetails.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
            No hay eventos con ventas registradas para la fecha seleccionada ({selectedDate}).
          </div>
        ) : (
          <div className="space-y-4">
            {eventDetails.map((ev) => {
              const isExpanded = expandedEvents[ev.eventId] ?? true;
              const chartData = [
                {
                  key: 'TARJETA',
                  label: 'Tarjeta',
                  icon: '💳',
                  amount: ev.payments.TARJETA.amount,
                  percentage: ev.payments.TARJETA.percentage,
                  color: '#2563EB',
                },
                {
                  key: 'TRANSFERENCIA',
                  label: 'Transferencia',
                  icon: '📲',
                  amount: ev.payments.TRANSFERENCIA.amount,
                  percentage: ev.payments.TRANSFERENCIA.percentage,
                  color: '#9333EA',
                },
                {
                  key: 'EFECTIVO',
                  label: 'Efectivo',
                  icon: '💵',
                  amount: ev.payments.EFECTIVO.amount,
                  percentage: ev.payments.EFECTIVO.percentage,
                  color: '#10B981',
                },
              ];

              return (
                <div
                  key={ev.eventId}
                  className="rounded-2xl bg-[#0d1525]/90 border border-slate-800/80 shadow-xl overflow-hidden"
                >
                  {/* Barra de cabecera desplegable idéntica al screenshot */}
                  <button
                    type="button"
                    onClick={() => toggleEvent(ev.eventId)}
                    className="w-full px-5 py-3.5 bg-slate-900/60 hover:bg-slate-900/90 flex items-center justify-between text-left transition-colors cursor-pointer border-b border-slate-800/60"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      )}
                      <span>🎪</span>
                      <span>
                        {ev.name} ({ev.transactions} transacciones - Q {ev.totalSold.toFixed(2)})
                      </span>
                    </div>

                    {ev.status === 'ACTIVO' && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        Stand Activo
                      </span>
                    )}
                  </button>

                  {/* Contenido expandido */}
                  {isExpanded && (
                    <div className="p-5 space-y-4">
                      {/* FILA 1: 3 Tarjetas Superiores */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* 1. Transacciones */}
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-[11px] font-medium text-slate-400 block mb-1">
                            Transacciones
                          </span>
                          <span className="text-2xl font-black text-slate-100 font-mono">
                            {ev.transactions}
                          </span>
                        </div>

                        {/* 2. Vendido en Evento */}
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-[11px] font-medium text-slate-400 block mb-1">
                            Vendido en Evento
                          </span>
                          <span className="text-2xl font-black text-slate-100 font-mono">
                            Q {ev.totalSold.toFixed(2)}
                          </span>
                        </div>

                        {/* 3. Última Venta */}
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mb-1">
                            <span>🧾</span> Última Venta
                          </span>
                          <span className="text-lg font-black text-slate-100 font-mono">
                            {ev.lastSale ? (
                              <>
                                Q {ev.lastSale.amount.toFixed(2)}{' '}
                                <span className="text-xs text-slate-400 font-normal">
                                  ({ev.lastSale.time})
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-slate-500 font-normal">
                                Sin ventas aún
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* FILA 2: 3 Tarjetas de Métodos de Pago con ↑ count */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Tarjeta */}
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                            <span>💳</span> Tarjeta
                          </span>
                          <div className="text-xl font-black text-slate-100 font-mono">
                            Q {ev.payments.TARJETA.amount.toFixed(2)}
                          </div>
                          <span className="text-[11px] text-blue-400 font-bold block mt-1">
                            ↑ {ev.payments.TARJETA.count}
                          </span>
                        </div>

                        {/* Transferencia */}
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                            <span>📲</span> Transferencia
                          </span>
                          <div className="text-xl font-black text-slate-100 font-mono">
                            Q {ev.payments.TRANSFERENCIA.amount.toFixed(2)}
                          </div>
                          <span className="text-[11px] text-purple-400 font-bold block mt-1">
                            ↑ {ev.payments.TRANSFERENCIA.count}
                          </span>
                        </div>

                        {/* Efectivo */}
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                            <span>💵</span> Efectivo
                          </span>
                          <div className="text-xl font-black text-slate-100 font-mono">
                            Q {ev.payments.EFECTIVO.amount.toFixed(2)}
                          </div>
                          <span className="text-[11px] text-emerald-400 font-bold block mt-1">
                            ↑ {ev.payments.EFECTIVO.count}
                          </span>
                        </div>
                      </div>

                      {/* FILA 3: Gráfico Donut de Distribución idéntico al screenshot */}
                      <div className="pt-2">
                        <DonutChart data={chartData} size={250} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SEPARADOR HORIZONTAL IDÉNTICO AL SCREENSHOT */}
      <hr className="border-slate-800/80 my-8" />

      {/* 4. SECCIÓN: 🏆 RESUMEN GENERAL DE LA JORNADA */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-base">🏆</span>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-100">
            Resumen General de la Jornada
          </h3>
        </div>

        {/* FILA 1: 2 Tarjetas Superiores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">
              Total de Transacciones
            </span>
            <span className="text-2xl font-black text-slate-100 font-mono">
              {resumenGeneral.totalTransactions || 0}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">
              Total Vendido
            </span>
            <span className="text-2xl font-black text-slate-100 font-mono">
              Q {(resumenGeneral.totalSold || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* FILA 2: 3 Tarjetas de Métodos de Pago Consolidadas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Tarjeta */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mb-1">
              <span>💳</span> Tarjeta
            </span>
            <div className="text-xl font-black text-slate-100 font-mono">
              Q {(resumenGeneral.payments?.TARJETA?.amount || 0).toFixed(2)}
            </div>
            <span className="text-[11px] text-blue-400 font-bold block mt-1">
              ↑ {resumenGeneral.payments?.TARJETA?.count || 0}
            </span>
          </div>

          {/* Transferencia */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mb-1">
              <span>📲</span> Transferencia
            </span>
            <div className="text-xl font-black text-slate-100 font-mono">
              Q {(resumenGeneral.payments?.TRANSFERENCIA?.amount || 0).toFixed(2)}
            </div>
            <span className="text-[11px] text-purple-400 font-bold block mt-1">
              ↑ {resumenGeneral.payments?.TRANSFERENCIA?.count || 0}
            </span>
          </div>

          {/* Efectivo */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mb-1">
              <span>💵</span> Efectivo
            </span>
            <div className="text-xl font-black text-slate-100 font-mono">
              Q {(resumenGeneral.payments?.EFECTIVO?.amount || 0).toFixed(2)}
            </div>
            <span className="text-[11px] text-emerald-400 font-bold block mt-1">
              ↑ {resumenGeneral.payments?.EFECTIVO?.count || 0}
            </span>
          </div>
        </div>

        {/* SUBSECCIÓN: 🎨 Distribución de Métodos de Pago Global */}
        <div className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🎨</span>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Distribución de Métodos de Pago
            </h4>
          </div>

          <DonutChart
            data={[
              {
                key: 'TARJETA',
                label: 'Tarjeta',
                icon: '💳',
                amount: resumenGeneral.payments?.TARJETA?.amount || 0,
                percentage: resumenGeneral.payments?.TARJETA?.percentage || 0,
                color: '#2563EB',
              },
              {
                key: 'TRANSFERENCIA',
                label: 'Transferencia',
                icon: '📲',
                amount: resumenGeneral.payments?.TRANSFERENCIA?.amount || 0,
                percentage: resumenGeneral.payments?.TRANSFERENCIA?.percentage || 0,
                color: '#9333EA',
              },
              {
                key: 'EFECTIVO',
                label: 'Efectivo',
                icon: '💵',
                amount: resumenGeneral.payments?.EFECTIVO?.amount || 0,
                percentage: resumenGeneral.payments?.EFECTIVO?.percentage || 0,
                color: '#10B981',
              },
            ]}
            size={270}
          />
        </div>
      </div>
    </div>
  );
}
