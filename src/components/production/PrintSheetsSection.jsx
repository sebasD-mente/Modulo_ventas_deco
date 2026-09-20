import React from 'react';
import { Plus, Printer, Search, RefreshCw, Layers, Check, AlertCircle } from 'lucide-react';
import usePrintSheets from './hooks/usePrintSheets';
import PrintSheetCard from './PrintSheetCard';
import CreatePrintSheetModal from './CreatePrintSheetModal';
import AssignItemsToSheetModal from './AssignItemsToSheetModal';
import PrintSheetDetailModal from './PrintSheetDetailModal';

const STATUS_TABS = [
  { id: 'ALL', label: 'Todos' },
  { id: 'ABIERTO', label: 'Abiertos' },
  { id: 'EN_PRODUCCION', label: 'En Producción' },
  { id: 'IMPRESO', label: 'Impresos' },
  { id: 'TERMINADO', label: 'Terminados' },
];

export default function PrintSheetsSection({ isOp2Only, isSuperAdmin }) {
  const p = usePrintSheets();

  const handleCreateAndOpenAssign = async (data) => {
    const newSheet = await p.createPrintSheet(data);
    if (newSheet) {
      p.fetchUnassignedItems();
      p.setAssignModalSheet(newSheet);
    }
  };

  const handleOpenAssignModal = (sheet) => {
    p.fetchUnassignedItems();
    p.setAssignModalSheet(sheet);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center text-cyan-400 shadow-inner">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Pliegos Diarios de Taller</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300">
                PLIEGOS LOTE
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Loteo por sustrato, cola de plotter y ruta de manufactura
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={p.refresh}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer"
            title="Refrescar pliegos"
          >
            <RefreshCw className={`w-4 h-4 ${p.isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => p.setIsCreateOpen(true)}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-black flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-950/50 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-black shrink-0" />
            <span>+ Nuevo Pliego</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          ['Total Pliegos', p.stats.total, 'text-white'],
          ['Abiertos', p.stats.abiertos, 'text-amber-400'],
          ['En Producción', p.stats.enProduccion, 'text-cyan-400'],
          ['Impresos', p.stats.impresos, 'text-emerald-400'],
        ].map(([label, val, col]) => (
          <div key={label} className="bg-black border border-neutral-800 rounded-2xl p-3 text-center">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{label}</div>
            <div className={`text-xl font-black ${col} mt-0.5`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Search & Material Filters */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={p.materialFilter}
            onChange={(e) => p.setMaterialFilter(e.target.value)}
            className="w-full min-h-[44px] bg-black border border-neutral-700/90 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white shadow-inner appearance-none cursor-pointer"
          >
            <option value="ALL">Todos los Materiales</option>
            <option value="PVC_5MM">PVC 5mm (Sintra Rígido)</option>
            <option value="MDF_5_5MM">MDF 5.5mm (Fibra Madera)</option>
            <option value="VINILO_SOLO">Vinilo Solo (Adhesivo)</option>
            <option value="MIXTO">Mixto (Varios Soportes)</option>
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código (PLI-...) o notas..."
              value={p.searchQuery}
              onChange={(e) => p.setSearchQuery(e.target.value)}
              className="w-full min-h-[44px] bg-black border border-neutral-700/90 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-white shadow-inner placeholder:text-neutral-500"
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const isSelected = p.statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => p.setStatusFilter(tab.id)}
                className={`min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-neutral-800 text-white border border-neutral-600 shadow-inner'
                    : 'bg-black text-neutral-400 border border-neutral-800/80 hover:text-white hover:border-neutral-700'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toast Notifications */}
      {p.successMsg && (
        <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-3 text-xs text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{p.successMsg}</span>
        </div>
      )}
      {p.errorMsg && (
        <div className="bg-red-950/60 border border-red-800 rounded-2xl p-3 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{p.errorMsg}</span>
        </div>
      )}

      {/* Sheets List */}
      <div className="space-y-3">
        {p.isLoading ? (
          <div className="py-16 text-center text-neutral-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
            <span>Cargando pliegos diarios de taller...</span>
          </div>
        ) : p.sheets.length === 0 ? (
          <div className="bg-black border border-neutral-800/80 rounded-2xl p-10 text-center text-neutral-400 text-xs space-y-2">
            <Layers className="w-8 h-8 text-neutral-600 mx-auto mb-1" />
            <p className="font-bold text-neutral-300">No hay pliegos registrados con los filtros seleccionados.</p>
            <p className="text-[11px] text-neutral-500">Haz clic en "+ Nuevo Pliego" para abrir un lote de manufactura.</p>
          </div>
        ) : (
          p.sheets.map((sheet) => (
            <PrintSheetCard
              key={sheet.id}
              sheet={sheet}
              onOpenDetail={p.setDetailModalSheetId}
              onOpenAssign={handleOpenAssignModal}
              onUpdateStatus={p.updateSheetStatus}
              isUpdating={p.actionLoadingId === sheet.id}
            />
          ))
        )}
      </div>

      {/* Subordinate Modals */}
      <CreatePrintSheetModal
        isOpen={p.isCreateOpen}
        onClose={() => p.setIsCreateOpen(false)}
        onCreate={handleCreateAndOpenAssign}
        isSubmitting={p.actionLoadingId === 'create'}
      />

      <AssignItemsToSheetModal
        sheet={p.assignModalSheet}
        isOpen={Boolean(p.assignModalSheet)}
        onClose={() => p.setAssignModalSheet(null)}
        onAssign={p.assignItemsToSheet}
        unassignedItems={p.unassignedItems}
        isLoading={p.isLoadingUnassigned}
        isSubmitting={Boolean(p.actionLoadingId && p.actionLoadingId === p.assignModalSheet?.id)}
        onRefreshItems={p.fetchUnassignedItems}
      />

      <PrintSheetDetailModal
        sheetId={p.detailModalSheetId}
        isOpen={Boolean(p.detailModalSheetId)}
        onClose={() => p.setDetailModalSheetId(null)}
        onUpdateStatus={p.updateSheetStatus}
        isUpdatingStatus={Boolean(p.actionLoadingId && p.actionLoadingId === p.detailModalSheetId)}
      />
    </div>
  );
}
