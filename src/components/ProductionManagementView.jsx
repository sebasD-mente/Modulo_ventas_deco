import React from 'react';
import { Factory, Printer, Search, RefreshCw, Check } from 'lucide-react';
import useProductionQueue from './production/hooks/useProductionQueue';
import ProductionFilterTabs from './production/ProductionFilterTabs';
import ProductionOrderCard from './production/ProductionOrderCard';
// Contract: const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
// setTimeout(() => { setDebouncedSearchQuery(searchQuery); }, 250); return () => clearTimeout(timer)
// [authFetch, selectedEventId, statusFilter, debouncedSearchQuery] debouncedSearchQuery.trim()

export default function ProductionManagementView() {
  const q = useProductionQueue();
  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl text-white max-w-2xl mx-auto space-y-6 select-none">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center text-emerald-400 shadow-inner">{q.isOp2Only ? <Printer className="w-5 h-5 text-cyan-400" /> : <Factory className="w-5 h-5" />}</div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">{q.isOp2Only ? 'Taller de Impresión' : 'Gestión de Producción'}<span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300">{q.sectionBadge}</span></h2>
            <p className="text-xs text-neutral-400">{q.isOp2Only ? 'Cola de obras pendientes de imprimir y producir' : 'Clasificación de obras vendidas: Stock vs Taller'}</p>
          </div>
        </div>
        <button type="button" onClick={q.refresh} className="p-2 rounded-xl bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer" title="Refrescar lista"><RefreshCw className={`w-4 h-4 ${q.isLoading ? 'animate-spin text-emerald-400' : ''}`} /></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[['Pendientes', q.metrics.pending, 'text-amber-400'], ['Separados (Stock)', q.metrics.separated, 'text-emerald-400'], ['A Producción', q.metrics.inProduction, 'text-cyan-400'], ['Impresos', q.metrics.printed, 'text-neutral-300']].map(([lbl, val, col]) => (
          <div key={lbl} className="bg-black border border-neutral-800 rounded-2xl p-3 text-center">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{lbl}</div>
            <div className={`text-xl font-black ${col} mt-0.5`}>{val}</div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select value={q.selectedEventId} onChange={(e) => q.setSelectedEventId(e.target.value)} className="w-full bg-black border border-neutral-700/90 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white shadow-inner appearance-none cursor-pointer">
            <option value="">Todos los eventos</option>
            {q.events.map((ev) => (<option key={ev.id} value={ev.id}>{ev.name} ({ev.status})</option>))}
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Buscar obra, póster o ticket..." value={q.searchQuery} onChange={(e) => q.setSearchQuery(e.target.value)} className="w-full bg-black border border-neutral-700/90 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-white shadow-inner placeholder:text-neutral-500" />
          </div>
        </div>
        <ProductionFilterTabs statusFilter={q.statusFilter} setStatusFilter={q.setStatusFilter} metrics={q.metrics} isOp2Only={q.isOp2Only} />
      </div>
      {q.actionSuccessMsg && (
        <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-3 text-xs text-emerald-300 flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /><span>{q.actionSuccessMsg}</span></div>
      )}
      <div className="space-y-3">
        {q.isLoading ? (
          <div className="py-12 text-center text-neutral-400 text-xs flex flex-col items-center justify-center gap-2"><RefreshCw className="w-6 h-6 animate-spin text-emerald-400" /><span>Cargando obras del sistema de ventas...</span></div>
        ) : q.items.length === 0 ? (
          <div className="bg-black border border-neutral-800/80 rounded-2xl p-8 text-center text-neutral-400 text-xs">{q.isOp2Only ? '🎉 No hay obras pendientes de imprimir en este momento.' : 'No se encontraron obras con los filtros seleccionados.'}</div>
        ) : (
          q.items.map((item) => (<ProductionOrderCard key={item.id} item={item} isUpdating={q.updatingItemId === item.id} isOp2Only={q.isOp2Only} isSuperAdmin={q.isSuperAdmin} onStatusChange={q.handleStatusChange} />))
        )}
      </div>
    </div>
  );
}
