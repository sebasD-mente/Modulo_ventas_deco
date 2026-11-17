import React, { useState } from 'react';
import { Package, Smartphone, Search, RefreshCw, Check, Printer, Archive, ClipboardList, Lock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useProductionQueue from './production/hooks/useProductionQueue';
import ProductionFilterTabs from './production/ProductionFilterTabs';
import ProductionOrderCard from './production/ProductionOrderCard';
import PrintSheetsSection from './production/PrintSheetsSection';

export default function ProductionManagementView() {
  const { isVendedorRedes, isSuperAdmin, isOperario1, isOperario2 } = useAuth();
  const isVendedorRedesOnly = Boolean(isVendedorRedes && !isSuperAdmin && !isOperario1 && !isOperario2);
  const q = useProductionQueue();
  const [viewMode, setViewMode] = useState('QUEUE'); // 'QUEUE' | 'SHEETS'

  const isReposiciones = q.sourceTab === 'REPOSICIONES';
  const isArchiveMode = q.queueBucket === 'ARCHIVE';
  const roleContextTitle = q.isOp2Only ? 'Taller de Impresión' : 'Gestión de Producción';

  const activeQueueCount = q.isOp2Only
    ? (q.metrics.inProduction ?? 0)
    : q.isOp1Only
      ? (q.metrics.pending ?? 0)
      : (q.metrics.pending ?? 0) + (q.metrics.inProduction ?? 0);

  const archiveQueueCount = q.isOp2Only
    ? (q.metrics.printed ?? 0)
    : (q.metrics.separated ?? 0) + (q.metrics.inProduction ?? 0) + (q.metrics.printed ?? 0);

  const activeBucketLabel = q.isOp2Only
    ? `Cola por Imprimir (${activeQueueCount})`
    : q.isOp1Only
      ? `Cola Pendiente (${activeQueueCount})`
      : `Cola Activa (${activeQueueCount})`;

  const archiveBucketLabel = q.isOp2Only
    ? `Archivo de Impresos (${archiveQueueCount})`
    : `Archivo de Resueltos (${archiveQueueCount})`;

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl text-white max-w-2xl mx-auto space-y-5 select-none">
      {/* Selector Maestro: Cola de Ítems Individuales vs Pliegos de Impresión (Taller) */}
      {!isVendedorRedesOnly && (
        <div className="grid grid-cols-2 gap-2 p-1 bg-black rounded-2xl border border-neutral-800">
          <button
            type="button"
            onClick={() => setViewMode('QUEUE')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              viewMode === 'QUEUE'
                ? 'bg-white text-black shadow-md font-black'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>Cola de Ítems Individuales</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('SHEETS')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              viewMode === 'SHEETS'
                ? 'bg-cyan-400 text-black shadow-md font-black'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>Pliegos de Impresión (Taller)</span>
          </button>
        </div>
      )}

      {viewMode === 'SHEETS' && !isVendedorRedesOnly ? (
        <PrintSheetsSection isOp2Only={q.isOp2Only} isSuperAdmin={isSuperAdmin} />
      ) : (
        <>
          {/* Selector de origen: Solo visible para encargados de producción */}
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
              <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center shadow-inner shrink-0">
                {q.isOp2Only ? (
                  <Printer className="w-5 h-5 text-cyan-400" />
                ) : isReposiciones ? (
                  <Package className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Smartphone className="w-5 h-5 text-cyan-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    {roleContextTitle}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300">
                    {isReposiciones ? 'STAND / FERIA' : 'TALLER REDES'}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                  {isReposiciones
                    ? 'Reposiciones de Stock (Stand/Feria)'
                    : 'Pedidos de Redes & Personalizados'}
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer shrink-0"
              title="Refrescar lista"
            >
              <RefreshCw className={`w-4 h-4 ${q.isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          {/* Métricas de producción reactivas al origen (Cero colores naranjas) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              ['Pendientes', q.metrics.pending, 'text-white'],
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

          {/* Selector Estricto de Bandeja: Cola Pendiente vs Archivo Inmutable de Resueltos */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-black rounded-2xl border border-neutral-800">
            <button
              type="button"
              data-testid="production-tab-active"
              aria-pressed={!isArchiveMode}
              onClick={() => q.handleBucketChange('ACTIVE')}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                !isArchiveMode
                  ? 'bg-white text-black shadow-md font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span className="truncate">{activeBucketLabel}</span>
            </button>
            <button
              type="button"
              data-testid="production-tab-archive"
              aria-pressed={isArchiveMode}
              onClick={() => q.handleBucketChange('ARCHIVE')}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isArchiveMode
                  ? 'bg-emerald-400 text-black shadow-md font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Archive className="w-4 h-4 shrink-0" />
              <span className="truncate">{archiveBucketLabel}</span>
            </button>
          </div>

          {isArchiveMode && (
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl px-3.5 py-2.5 text-[11px] text-neutral-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Archivo de solo lectura: cada diseño resuelto queda sellado con usuario, fecha y hora sin opción de modificación.
              </span>
            </div>
          )}

          {/* Filtros: Eventos, Búsqueda y Sub-estados */}
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
              isOp1Only={q.isOp1Only}
              queueBucket={q.queueBucket}
            />
          </div>

          {/* Contador de escala (>300+ diseños) */}
          {!q.isLoading && (
            <div
              data-testid="production-queue-counter"
              className="flex items-center justify-between text-[11px] text-neutral-400 px-1"
            >
              <span>
                Mostrando <strong className="text-white">{q.items.length}</strong> de{' '}
                <strong className="text-white">{q.pagination.total}</strong> diseños
              </span>
              {q.pagination.totalPages > 1 && (
                <span>
                  Página {q.pagination.page} de {q.pagination.totalPages}
                </span>
              )}
            </div>
          )}

          {/* Alertas de estado */}
          {q.actionSuccessMsg && (
            <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-3 text-xs text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{q.actionSuccessMsg}</span>
            </div>
          )}
          {q.actionErrorMsg && (
            <div className="bg-red-950/60 border border-red-800 rounded-2xl p-3 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{q.actionErrorMsg}</span>
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
                {isArchiveMode
                  ? 'Aún no hay diseños resueltos en el archivo con los filtros seleccionados.'
                  : (q.isOp2Only ? '🎉 No hay obras pendientes de imprimir en este momento.' : (isReposiciones
                      ? 'No hay reposiciones de stock ferial pendientes con los filtros seleccionados.'
                      : 'No hay pedidos de redes o personalizados pendientes con los filtros seleccionados.'))}
              </div>
            ) : (
              q.items.map((item) => (
                <ProductionOrderCard
                  key={item.id}
                  item={item}
                  isUpdating={q.updatingItemId === item.id}
                  isOp2Only={q.isOp2Only}
                  hasOp2Access={Boolean(q.isOperario2)}
                  isSuperAdmin={q.isSuperAdmin}
                  isVendedorRedesOnly={isVendedorRedesOnly}
                  isArchiveMode={isArchiveMode}
                  onStatusChange={q.handleStatusChange}
                />
              ))
            )}
          </div>

          {/* Controles de paginación accesibles cuando la cola supera 500 diseños */}
          {!q.isLoading && q.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                disabled={!q.pagination.hasPrev}
                onClick={() => q.setPage((prev) => Math.max(1, prev - 1))}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-black border border-neutral-700 text-xs font-bold text-white hover:border-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
              <span className="text-xs text-neutral-300 font-semibold">
                Página {q.pagination.page} / {q.pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={!q.pagination.hasNext}
                onClick={() => q.setPage((prev) => prev + 1)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-black border border-neutral-700 text-xs font-bold text-white hover:border-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
