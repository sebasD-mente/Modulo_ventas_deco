import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Factory,
  CheckCircle2,
  Clock,
  Printer,
  Package,
  Layers,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Check,
  Calendar,
} from 'lucide-react';

export default function ProductionManagementView() {
  const { user, authFetch, isSuperAdmin, isOperario1, isOperario2 } = useAuth();
  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState({ pending: 0, separated: 0, inProduction: 0, printed: 0, total: 0 });
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDIENTE' | 'SEPARADO' | 'A_PRODUCCION' | 'IMPRESO'
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  // Cargar eventos para el selector de filtro
  const fetchEvents = useCallback(async () => {
    try {
      const res = await authFetch('/api/events');
      const data = await res.json();
      if (data.success && data.data) {
        setEvents(data.data);
      }
    } catch (err) {
      console.error('Error cargando eventos:', err);
    }
  }, [authFetch]);

  // Cargar métricas de producción
  const fetchMetrics = useCallback(async () => {
    try {
      const url = selectedEventId
        ? `/api/production/metrics?eventId=${selectedEventId}`
        : '/api/production/metrics';
      const res = await authFetch(url);
      const data = await res.json();
      if (data.success && data.data) {
        setMetrics(data.data);
      }
    } catch (err) {
      console.error('Error cargando métricas de producción:', err);
    }
  }, [authFetch, selectedEventId]);

  // Cargar lista de obras/ítems
  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedEventId) params.append('eventId', selectedEventId);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await authFetch(`/api/production/items?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.data) {
        setItems(data.data);
      }
    } catch (err) {
      console.error('Error cargando obras de producción:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, selectedEventId, statusFilter, searchQuery]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchItems();
    fetchMetrics();
  }, [fetchItems, fetchMetrics]);

  // Cambiar estado de una obra
  const handleStatusChange = async (itemId, newStatus) => {
    try {
      setUpdatingItemId(itemId);
      const res = await authFetch(`/api/production/items/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        setActionSuccessMsg(`Obra actualizada a ${newStatus}`);
        setTimeout(() => setActionSuccessMsg(null), 3000);
        // Actualizar lista y métricas en vivo
        fetchItems();
        fetchMetrics();
      } else {
        alert(data.error || 'Error al actualizar estado.');
      }
    } catch (err) {
      console.error('Error cambiando estado:', err);
      alert('Error de conexión al actualizar estado.');
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Determinar rol efectivo para renderizar la interfaz
  const isOp2Only = isOperario2 && !isOperario1 && !isSuperAdmin;
  const sectionBadge = isSuperAdmin
    ? 'SUPER ADMIN'
    : (isOperario1 && isOperario2
        ? 'PRODUCCIÓN TOTAL'
        : (isOperario2 ? 'TALLER' : (isOperario1 ? 'STOCK & PRODUCCIÓN' : 'OPERADOR')));

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl text-white max-w-2xl mx-auto space-y-6 select-none">
      {/* 1. Encabezado de la Vista */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center text-emerald-400 shadow-inner">
            {isOp2Only ? <Printer className="w-5 h-5 text-cyan-400" /> : <Factory className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              {isOp2Only ? 'Taller de Impresión' : 'Gestión de Producción'}
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300">
                {sectionBadge}
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              {isOp2Only
                ? 'Cola de obras pendientes de imprimir y producir'
                : 'Clasificación de obras vendidas: Stock vs Taller'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchItems();
            fetchMetrics();
          }}
          className="p-2 rounded-xl bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer"
          title="Refrescar lista"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* 2. Banner de Métricas en Vivo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-black border border-neutral-800 rounded-2xl p-3 text-center">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Pendientes</div>
          <div className="text-xl font-black text-amber-400 mt-0.5">{metrics.pending}</div>
        </div>
        <div className="bg-black border border-neutral-800 rounded-2xl p-3 text-center">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Separados (Stock)</div>
          <div className="text-xl font-black text-emerald-400 mt-0.5">{metrics.separated}</div>
        </div>
        <div className="bg-black border border-neutral-800 rounded-2xl p-3 text-center">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">A Producción</div>
          <div className="text-xl font-black text-cyan-400 mt-0.5">{metrics.inProduction}</div>
        </div>
        <div className="bg-black border border-neutral-800 rounded-2xl p-3 text-center">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Impresos</div>
          <div className="text-xl font-black text-neutral-300 mt-0.5">{metrics.printed}</div>
        </div>
      </div>

      {/* 3. Filtros y Búsqueda */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Selector de Evento */}
          <div className="relative">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full bg-black border border-neutral-700/90 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white shadow-inner appearance-none cursor-pointer"
            >
              <option value="">Todos los eventos</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.status})
                </option>
              ))}
            </select>
          </div>

          {/* Barra de Búsqueda */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar obra, póster o ticket..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-neutral-700/90 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-white shadow-inner placeholder:text-neutral-500"
            />
          </div>
        </div>

        {/* Pestañas de Estado (para Operario 1 y Super Admin) */}
        {!isOp2Only && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'PENDIENTE', label: `Pendientes (${metrics.pending})` },
              { id: 'SEPARADO', label: `Separados (${metrics.separated})` },
              { id: 'A_PRODUCCION', label: `A Producción (${metrics.inProduction})` },
              { id: 'IMPRESO', label: `Impresos (${metrics.printed})` },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-black border border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Alerta de Éxito Transitoria */}
      {actionSuccessMsg && (
        <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-3 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* 4. Lista de Obras Vendidas */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-neutral-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Cargando obras del sistema de ventas...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-black border border-neutral-800/80 rounded-2xl p-8 text-center text-neutral-400 text-xs">
            {isOp2Only
              ? '🎉 No hay obras pendientes de imprimir en este momento.'
              : 'No se encontraron obras con los filtros seleccionados.'}
          </div>
        ) : (
          items.map((item) => {
            const isUpdating = updatingItemId === item.id;
            const status = item.productionStatus || 'PENDIENTE';

            return (
              <div
                key={item.id}
                className={`bg-black border rounded-2xl p-3.5 sm:p-4 transition-all ${
                  status === 'A_PRODUCCION'
                    ? 'border-cyan-500/40 bg-cyan-950/10'
                    : status === 'SEPARADO'
                    ? 'border-emerald-500/30'
                    : status === 'IMPRESO'
                    ? 'border-neutral-800 opacity-60'
                    : 'border-neutral-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Miniatura de la Obra / Póster */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.product?.imageUrl ? (
                      <img
                        src={item.product.imageUrl}
                        alt={item.description}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-neutral-600" />
                    )}
                  </div>

                  {/* Detalles de la Obra y Venta */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                        {item.description}
                      </h4>
                      {item.quantity > 1 && (
                        <span className="bg-neutral-800 text-white font-black text-[10px] px-1.5 py-0.5 rounded-md">
                          x{item.quantity}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400">
                      <span className="font-semibold text-neutral-300">
                        Ticket: #{item.sale?.saleNumber || 'S/N'}
                      </span>
                      <span>•</span>
                      <span>{item.sale?.event?.name || 'Evento'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Badge de Estado Actual */}
                    <div className="pt-1 flex items-center gap-2">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          status === 'PENDIENTE'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/80'
                            : status === 'SEPARADO'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                            : status === 'A_PRODUCCION'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80'
                            : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                        }`}
                      >
                        {status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Acciones según Rol */}
                <div className="mt-3 pt-3 border-t border-neutral-900 flex items-center justify-end gap-2">
                  {/* Flujo OPERARIO 1 & SUPER ADMIN: Clasificación Stock vs Taller */}
                  {(!isOp2Only || isSuperAdmin) && (
                    <>
                      {status !== 'SEPARADO' && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleStatusChange(item.id, 'SEPARADO')}
                          className="bg-emerald-600 hover:bg-emerald-500 text-black font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Package className="w-3.5 h-3.5" />
                          <span>📦 Separar Stock</span>
                        </button>
                      )}

                      {status !== 'A_PRODUCCION' && status !== 'IMPRESO' && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleStatusChange(item.id, 'A_PRODUCCION')}
                          className="bg-white hover:bg-neutral-200 text-black font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Printer className="w-3.5 h-3.5 text-black" />
                          <span>🖨️ A Producción</span>
                        </button>
                      )}

                      {status !== 'PENDIENTE' && isSuperAdmin && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleStatusChange(item.id, 'PENDIENTE')}
                          className="bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs px-2.5 py-2 rounded-xl border border-neutral-800 transition-all cursor-pointer"
                        >
                          Revertir
                        </button>
                      )}
                    </>
                  )}

                  {/* Flujo OPERARIO 2: Marcar como Impreso */}
                  {(isOp2Only || (isSuperAdmin && status === 'A_PRODUCCION')) && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleStatusChange(item.id, 'IMPRESO')}
                      className="w-full sm:w-auto bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4 text-black" />
                      <span>✅ Marcar como IMPRESO (Archivar)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
