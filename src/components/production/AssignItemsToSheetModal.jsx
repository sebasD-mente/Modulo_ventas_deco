import React, { useState, useMemo, useEffect } from 'react';
import { X, Lock, CheckCircle2, AlertCircle, Loader2, Layers, Search, RefreshCw, Scissors } from 'lucide-react';

export default function AssignItemsToSheetModal({
  sheet,
  isOpen,
  onClose,
  onAssign,
  unassignedItems = [],
  isLoading = false,
  isSubmitting = false,
  onRefreshItems,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterSearch, setFilterSearch] = useState('');
  const [onlyMatchingMaterial, setOnlyMatchingMaterial] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setLocalError(null);
      if (onRefreshItems) onRefreshItems();
    }
  }, [isOpen, onRefreshItems]);

  const checkIsBlocked = (item) => {
    const sale = item.sale || {};
    const isAnulada = sale.status === 'ANULADA';
    const isPendingDeposit = sale.paymentStatus === 'PENDIENTE_ANTICIPO';
    const isMissingDeposit = !['ANTICIPO_PAGADO', 'PAGADO_TOTAL'].includes(sale.paymentStatus);
    return isAnulada || isPendingDeposit || isMissingDeposit;
  };

  const filteredItems = useMemo(() => {
    return unassignedItems.filter((item) => {
      if (onlyMatchingMaterial && sheet?.material && sheet.material !== 'MIXTO') {
        if (item.material && item.material !== sheet.material) return false;
      }
      if (filterSearch.trim()) {
        const query = filterSearch.toLowerCase().trim();
        const desc = (item.description || '').toLowerCase();
        const saleNum = (item.sale?.saleNumber || '').toLowerCase();
        const cust = (item.sale?.customer?.fullName || '').toLowerCase();
        if (!desc.includes(query) && !saleNum.includes(query) && !cust.includes(query)) return false;
      }
      return true;
    });
  }, [unassignedItems, onlyMatchingMaterial, sheet?.material, filterSearch]);

  if (!isOpen || !sheet) return null;

  const toggleSelect = (id, isBlocked) => {
    if (isBlocked || isSubmitting) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllEligible = () => {
    const next = new Set();
    filteredItems.forEach((it) => {
      if (!checkIsBlocked(it)) next.add(it.id);
    });
    setSelectedIds(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (selectedIds.size === 0) {
      setLocalError('Debes seleccionar al menos una obra autorizada para asignar al pliego.');
      return;
    }
    try {
      await onAssign(sheet.id, Array.from(selectedIds));
      onClose();
    } catch (err) {
      setLocalError(err.message || 'Error al asignar obras al pliego.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#121212] border border-neutral-800 rounded-[32px] p-5 sm:p-6 max-w-2xl w-full shadow-2xl text-white space-y-4 max-h-[90vh] flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Asignar Obras a Pliego</h3>
                <span className="text-xs font-mono font-bold text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800">
                  {sheet.sheetCode}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Material: <span className="font-bold text-neutral-200">{sheet.material}</span> • Loteo blindado con freno de taller
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {localError && (
          <div className="bg-red-950/40 border border-red-800/80 rounded-2xl p-3 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{localError}</span>
          </div>
        )}

        {/* Toolbar & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por obra, orden # o cliente..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full min-h-[44px] bg-black border border-neutral-800 rounded-2xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyMatchingMaterial(!onlyMatchingMaterial)}
              className={`flex-1 min-h-[44px] px-3 py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${onlyMatchingMaterial ? 'bg-cyan-950/50 border-cyan-400 text-cyan-300' : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'}`}
            >
              Mismo Material ({sheet.material})
            </button>
            <button type="button" onClick={onRefreshItems} disabled={isLoading} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-black border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer" title="Refrescar obras">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Selection summary */}
        <div className="flex items-center justify-between text-xs px-1 text-neutral-400">
          <span>{selectedIds.size} seleccionada(s) de {filteredItems.length} disponible(s)</span>
          <div className="flex gap-2">
            <button type="button" onClick={selectAllEligible} className="text-cyan-400 hover:underline font-bold cursor-pointer">Seleccionar Habilitados</button>
            <span>•</span>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="text-neutral-400 hover:text-white cursor-pointer">Limpiar</button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1 space-y-2 pr-1 max-h-[360px]">
          {isLoading ? (
            <div className="py-12 text-center text-neutral-400 text-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <span>Cargando obras disponibles en taller...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 text-xs bg-black rounded-2xl border border-neutral-800">
              No hay obras pendientes que coincidan con los filtros.
            </div>
          ) : (
            filteredItems.map((item) => {
              const sale = item.sale || {};
              const isBlocked = checkIsBlocked(item);
              const isSelected = selectedIds.has(item.id);
              const customerName = sale.customer?.fullName || 'Cliente de Mostrador';
              const balanceDue = Number(sale.balanceDue || 0).toFixed(2);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id, isBlocked)}
                  className={`p-3 rounded-2xl transition-all flex items-start gap-3 select-none ${
                    isBlocked
                      ? 'bg-red-950/20 border border-red-900/40 opacity-70 cursor-not-allowed'
                      : isSelected
                      ? 'bg-neutral-900 border border-cyan-400 cursor-pointer shadow-sm'
                      : 'bg-black border border-neutral-800 hover:border-neutral-700 cursor-pointer'
                  }`}
                >
                  <div className="min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isBlocked}
                      onChange={() => toggleSelect(item.id, isBlocked)}
                      className={`w-5 h-5 rounded border cursor-pointer accent-cyan-400 ${isBlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center text-neutral-500">
                    {item.customImageUrl || item.product?.imageUrl ? (
                      <a
                        href={item.customImageUrl || item.product?.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Abrir imagen en alta resolución"
                        className="w-full h-full block cursor-pointer"
                      >
                        <img src={item.customImageUrl || item.product?.imageUrl} alt={item.description} className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <Layers className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{item.description}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(item.isCustom || item.customDimensions?.toLowerCase().includes('corte taller') || item.description?.toLowerCase().includes('corte taller')) && (
                          <span className="bg-amber-950/80 text-amber-300 border border-amber-700/80 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <Scissors className="w-3 h-3 text-amber-400" />
                            <span>Corte Taller</span>
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                          {item.material || 'Material estándar'}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      Orden <span className="font-semibold text-neutral-200">#{sale.saleNumber || 'S/N'}</span> • {customerName}
                      {item.customDimensions && <span> • Dim: {item.customDimensions}</span>}
                    </div>
                    <div className="mt-1.5">
                      {isBlocked ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-semibold" title="Prohibido meter a taller pedidos sin anticipo confirmado">
                          <Lock className="w-3.5 h-3.5 shrink-0 text-red-400" />
                          <span>🔒 BLOQUEADO: Pedido #{sale.saleNumber || 'S/N'} sin anticipo (Pendiente Q {balanceDue})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                          <span>🟢 Anticipo Confirmado</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-neutral-800">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs font-bold text-neutral-300 hover:bg-neutral-800 hover:text-white transition-all cursor-pointer">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedIds.size === 0}
            className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              selectedIds.size > 0 && !isSubmitting
                ? 'bg-cyan-400 hover:bg-cyan-300 text-black cursor-pointer shadow-lg shadow-cyan-950/50'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Asignando...</span>
              </>
            ) : (
              <span>Asignar {selectedIds.size} obra(s) a este Pliego</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
