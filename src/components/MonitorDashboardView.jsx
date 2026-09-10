import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
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
  const { authFetch } = useAuth();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [monitorData, setMonitorData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [expandedEvents, setExpandedEvents] = useState({});
  const pollingRef = useRef(null);

  const fetchMonitorData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await authFetch(`/api/sales/monitor?date=${selectedDate}`);
      const json = await res.json();
      if (json.success && json.data) {
        setMonitorData(json.data);
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

        // Por defecto abrir todos los eventos
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
      <div className="bg-[#121212] p-8 sm:p-12 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl flex flex-col items-center justify-center text-white max-w-2xl mx-auto space-y-3">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
        <span className="text-xs font-bold tracking-wider uppercase text-neutral-400">
          Sincronizando monitor de ventas en vivo...
        </span>
      </div>
    );
  }

  const { eventDetails = [], resumenGeneral = {} } = monitorData || {};

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl space-y-6 text-white max-w-2xl mx-auto">
      {/* 1. ENCABEZADO Y ESTADO EN VIVO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white text-black flex items-center justify-center text-lg font-black shadow-sm select-none">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              Monitor de ventas
            </h3>
            <p className="text-xs text-neutral-400">
              Rendimiento y transacciones de stands en tiempo real
            </p>
          </div>
        </div>

        {/* Badge EN VIVO */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500 bg-white text-emerald-600 font-extrabold text-xs shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>EN VIVO</span>
          </div>
          <span className="text-[11px] text-neutral-400 font-mono">{lastSyncTime}</span>
        </div>
      </div>

      {/* 2. BARRA DE CONTROL: Fecha y Actualizar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-black border border-neutral-800">
        <div className="flex items-center gap-2 flex-1">
          <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
          <span className="text-xs font-bold text-neutral-300 shrink-0">Fecha:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#181818] border border-neutral-700/90 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white w-full max-w-[200px]"
          />
        </div>

        <button
          type="button"
          onClick={() => fetchMonitorData(true)}
          disabled={isRefreshing}
          className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95 cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* 3. SECCIÓN: DETALLE POR EVENTO */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
            Detalle por evento ({eventDetails.length})
          </label>
        </div>

        {eventDetails.length === 0 ? (
          <div className="p-6 rounded-2xl bg-black border border-neutral-800 text-center text-xs text-neutral-500">
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
                  color: '#3B82F6',
                },
                {
                  key: 'TRANSFERENCIA',
                  label: 'Transferencia',
                  icon: '📲',
                  amount: ev.payments.TRANSFERENCIA.amount,
                  percentage: ev.payments.TRANSFERENCIA.percentage,
                  color: '#A855F7',
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
                  className="rounded-2xl bg-black border border-neutral-800 shadow-xl overflow-hidden"
                >
                  {/* Barra de cabecera desplegable */}
                  <button
                    type="button"
                    onClick={() => toggleEvent(ev.eventId)}
                    className="w-full px-4 sm:px-5 py-3.5 bg-neutral-900/60 hover:bg-neutral-900 flex items-center justify-between text-left transition-colors cursor-pointer border-b border-neutral-800/80"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-neutral-400" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-neutral-400" />
                      )}
                      <span>🎪 {ev.name}</span>
                      <span className="text-neutral-400 font-normal font-mono">
                        ({ev.transactions} tx • Q {ev.totalSold.toFixed(2)})
                      </span>
                    </div>

                    {ev.status === 'ACTIVO' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-white text-emerald-600 border border-emerald-500 shadow-sm">
                        Stand Activo
                      </span>
                    )}
                  </button>

                  {/* Contenido expandido */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-4">
                      {/* FILA 1: 3 Tarjetas Superiores */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* 1. Transacciones */}
                        <div className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                            Transacciones
                          </span>
                          <span className="text-xl font-black text-white font-mono">
                            {ev.transactions}
                          </span>
                        </div>

                        {/* 2. Vendido en Evento */}
                        <div className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                            Total Vendido
                          </span>
                          <span className="text-xl font-black text-emerald-400 font-mono">
                            Q {ev.totalSold.toFixed(2)}
                          </span>
                        </div>

                        {/* 3. Última Venta */}
                        <div className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                            Última Venta
                          </span>
                          <span className="text-sm font-black text-white font-mono">
                            {ev.lastSale ? (
                              <>
                                Q {ev.lastSale.amount.toFixed(2)}{' '}
                                <span className="text-[10px] text-neutral-400 font-normal">
                                  ({ev.lastSale.time})
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-neutral-500 font-normal">
                                Sin ventas
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* FILA 2: 3 Tarjetas de Métodos de Pago */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* Tarjeta */}
                        <div className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800">
                          <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 mb-1">
                            <span>💳</span> Tarjeta
                          </span>
                          <div className="text-lg font-black text-white font-mono">
                            Q {ev.payments.TARJETA.amount.toFixed(2)}
                          </div>
                          <span className="text-[10px] text-blue-400 font-bold block mt-0.5">
                            ↑ {ev.payments.TARJETA.count} ventas
                          </span>
                        </div>

                        {/* Transferencia */}
                        <div className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800">
                          <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 mb-1">
                            <span>📲</span> Transferencia
                          </span>
                          <div className="text-lg font-black text-white font-mono">
                            Q {ev.payments.TRANSFERENCIA.amount.toFixed(2)}
                          </div>
                          <span className="text-[10px] text-purple-400 font-bold block mt-0.5">
                            ↑ {ev.payments.TRANSFERENCIA.count} ventas
                          </span>
                        </div>

                        {/* Efectivo */}
                        <div className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800">
                          <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 mb-1">
                            <span>💵</span> Efectivo
                          </span>
                          <div className="text-lg font-black text-white font-mono">
                            Q {ev.payments.EFECTIVO.amount.toFixed(2)}
                          </div>
                          <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                            ↑ {ev.payments.EFECTIVO.count} ventas
                          </span>
                        </div>
                      </div>

                      {/* FILA 3: Gráfico Donut de Distribución */}
                      <div className="pt-2">
                        <DonutChart data={chartData} size={230} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. RESUMEN GENERAL DE LA JORNADA */}
      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block flex items-center gap-1.5">
          <span>🏆</span> Resumen general de la jornada
        </label>

        {/* FILA 1: 2 Tarjetas Superiores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="p-4 rounded-2xl bg-black border border-neutral-800">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
              Total de transacciones
            </span>
            <span className="text-2xl font-black text-white font-mono">
              {resumenGeneral.totalTransactions || 0}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-black border border-neutral-800">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
              Total vendido general
            </span>
            <span className="text-2xl font-black text-emerald-400 font-mono">
              Q {(resumenGeneral.totalSold || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* FILA 2: 3 Tarjetas de Métodos de Pago Consolidadas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Tarjeta */}
          <div className="p-3.5 rounded-2xl bg-black border border-neutral-800">
            <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 mb-1">
              <span>💳</span> Tarjeta
            </span>
            <div className="text-lg font-black text-white font-mono">
              Q {(resumenGeneral.payments?.TARJETA?.amount || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-blue-400 font-bold block mt-0.5">
              ↑ {resumenGeneral.payments?.TARJETA?.count || 0} ventas
            </span>
          </div>

          {/* Transferencia */}
          <div className="p-3.5 rounded-2xl bg-black border border-neutral-800">
            <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 mb-1">
              <span>📲</span> Transferencia
            </span>
            <div className="text-lg font-black text-white font-mono">
              Q {(resumenGeneral.payments?.TRANSFERENCIA?.amount || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-purple-400 font-bold block mt-0.5">
              ↑ {resumenGeneral.payments?.TRANSFERENCIA?.count || 0} ventas
            </span>
          </div>

          {/* Efectivo */}
          <div className="p-3.5 rounded-2xl bg-black border border-neutral-800">
            <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 mb-1">
              <span>💵</span> Efectivo
            </span>
            <div className="text-lg font-black text-white font-mono">
              Q {(resumenGeneral.payments?.EFECTIVO?.amount || 0).toFixed(2)}
            </div>
            <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
              ↑ {resumenGeneral.payments?.EFECTIVO?.count || 0} ventas
            </span>
          </div>
        </div>

        {/* Distribución de Métodos de Pago Global */}
        <div className="pt-2">
          <DonutChart
            data={[
              {
                key: 'TARJETA',
                label: 'Tarjeta',
                icon: '💳',
                amount: resumenGeneral.payments?.TARJETA?.amount || 0,
                percentage: resumenGeneral.payments?.TARJETA?.percentage || 0,
                color: '#3B82F6',
              },
              {
                key: 'TRANSFERENCIA',
                label: 'Transferencia',
                icon: '📲',
                amount: resumenGeneral.payments?.TRANSFERENCIA?.amount || 0,
                percentage: resumenGeneral.payments?.TRANSFERENCIA?.percentage || 0,
                color: '#A855F7',
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
            size={250}
          />
        </div>
      </div>
    </div>
  );
}
