import React from 'react';
import { Package, Smartphone, Search, RefreshCw, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useProductionQueue from './production/hooks/useProductionQueue';
import ProductionFilterTabs from './production/ProductionFilterTabs';
import ProductionOrderCard from './production/ProductionOrderCard';

export default function ProductionManagementView() {
  const { isVendedorRedes, isSuperAdmin, isOperario1, isOperario2 } = useAuth();
  const isVendedorRedesOnly = Boolean(isVendedorRedes && !isSuperAdmin && !isOperario1 && !isOperario2);
  const q = useProductionQueue();

  const isReposiciones = q.sourceTab === 'REPOSICIONES';

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl text-white max-w-2xl mx-auto space-y-6 select-none">
      {/* Selector superior: Solo visible para encargados de producción (Operarios y Super Admin) */}
      {!isVendedorRedesOnly && (
        <div className="grid grid-cols-2 gap-2 p-1 bg-black rounded-2xl border border-neutral-800">
          <button
            type="button"
            onClick={() => q.setSourceTab('REPOSICIONES')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isReposiciones
                ? 'bg-white text-black shadow-md font-black'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>Reposiciones</span>
          </button>
          <button
            type="button"
            onClick={() => q.setSourceTab('PEDIDOS')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              !isReposiciones
                ? 'bg-cyan-400 text-black shadow-md font-black'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>Pedidos</span>
          </button>
        </div>
      )}

      {/* Encabezado contextual dinámico */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center shadow-inner">
            {isReposiciones ? (
              <Package className="w-5 h-5 text-emerald-400" />
            ) : (
              <Smartphone className="w-5 h-5 text-cyan-400" />
            )}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              {isReposiciones
                ? 'Reposiciones de Stock (Stand/Feria)'
                : 'Pedidos de Redes & Personalizados'}
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300">
                {isReposiciones ? 'STAND / FERIA' : 'TALLER REDES'}
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              {isReposiciones
                ? 'Obras vendidas en piso de venta que requieren reposición física o taller'
                : 'Diseños encargados en línea pendientes de impresión y taller'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={q.refresh}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer"
          title="Refrescar lista"
        >
          <RefreshCw className={`w-4 h-4 ${q.isLoading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Métricas de producción reactivas al origen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          ['Pendientes', q.metrics.pending, 'text-amber-400'],
          ['Separados (Stock)', q.metrics.separated, 'text-emerald-400'],
          ['A Producción', q.metrics.inProduction, 'text-cyan-400'],
          ['Impresos', q.metrics.printed, 'text-neutral-300'],
        ].map(([lbl, val, col]) => (
          <div key={lbl} className="bg-black border border-neutral-800 rounded-2xl p-3 text-center">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{lbl}</div>
            <div className={`text-xl font-black ${col} mt-0.5`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filtros: Eventos, Búsqueda y Estados */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={q.selectedEventId}
            onChange={(e) => q.setSelectedEventId(e.target.value)}
            className="w-full min-h-[44px] bg-black border border-neutral-700/90 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white shadow-inner appearance-none cursor-pointer"
          >
            <option value="">Todos los eventos</option>
            {q.events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({ev.status})
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar obra, póster o ticket..."
              value={q.searchQuery}
              onChange={(e) => q.setSearchQuery(e.target.value)}
              className="w-full min-h-[44px] bg-black border border-neutral-700/90 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-white shadow-inner placeholder:text-neutral-500"
            />
          </div>
        </div>
        <ProductionFilterTabs
          statusFilter={q.statusFilter}
          setStatusFilter={q.setStatusFilter}
          metrics={q.metrics}
          isOp2Only={q.isOp2Only}
        />
      </div>

      {/* Alerta de acción exitosa */}
      {q.actionSuccessMsg && (
        <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-3 text-xs text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{q.actionSuccessMsg}</span>
        </div>
      )}

      {/* Lista fluida de tarjetas de órdenes */}
      <div className="space-y-3">
        {q.isLoading ? (
          <div className="py-12 text-center text-neutral-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Cargando obras del sistema de ventas...</span>
          </div>
        ) : q.items.length === 0 ? (
          <div className="bg-black border border-neutral-800/80 rounded-2xl p-8 text-center text-neutral-400 text-xs">
            {isReposiciones
              ? 'No hay reposiciones de stock ferial pendientes con los filtros seleccionados.'
              : 'No hay pedidos de redes o personalizados pendientes con los filtros seleccionados.'}
          </div>
        ) : (
          q.items.map((item) => (
            <ProductionOrderCard
              key={item.id}
              item={item}
              isUpdating={q.updatingItemId === item.id}
              isOp2Only={q.isOp2Only}
              isSuperAdmin={q.isSuperAdmin}
              isVendedorRedesOnly={isVendedorRedesOnly}
              onStatusChange={q.handleStatusChange}
            />
          ))
        )}
      </div>
    </div>
  );
}
