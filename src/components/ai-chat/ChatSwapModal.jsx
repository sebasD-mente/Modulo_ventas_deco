import React from 'react';
import { Search, RefreshCw, X, Loader2 } from 'lucide-react';

export default function ChatSwapModal({
  isOpen, swappingIndex, onClose, closeSwapModal,
  swapQuery = '', onSearchChange, handleSwapSearchChange,
  swapResults = [], isSearchingSwap = false,
  onSelectPoster, selectSwapPoster
}) {
  const visible = isOpen !== undefined ? isOpen : (swappingIndex !== null && swappingIndex !== undefined);
  if (!visible) return null;

  const handleClose = onClose || closeSwapModal;
  const handleChange = onSearchChange || handleSwapSearchChange;
  const handleSelect = onSelectPoster || selectSwapPoster;

  return (
    <div className="absolute inset-0 bg-black/95 backdrop-blur-md z-30 p-4 flex flex-col animate-fadeIn text-white">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
        <span className="text-xs font-bold text-white flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> Seleccionar Póster de Reemplazo
        </span>
        {handleClose && (
          <button type="button" onClick={handleClose} className="text-neutral-400 hover:text-white p-1 cursor-pointer" title="Cerrar">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="relative my-2">
        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Escribe el nombre o personaje... (ej. Goku, Taylor, Spider-Man)"
          value={swapQuery}
          onChange={(e) => handleChange?.(e.target.value)}
          autoFocus
          className="w-full bg-[#161616] border border-neutral-700 rounded-full pl-8 pr-4 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 no-scrollbar pr-1">
        {isSearchingSwap ? (
          <div className="flex items-center justify-center p-6 text-xs text-neutral-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2 text-white" />
            Buscando en catálogo oficial...
          </div>
        ) : swapResults.length === 0 ? (
          <div className="text-center p-6 text-xs text-neutral-400">
            No se encontraron obras coincidentes. Escribe otras palabras clave.
          </div>
        ) : (
          swapResults.map((p) => (
            <div
              key={p.id}
              onClick={() => handleSelect?.(p)}
              className="p-2.5 rounded-xl bg-[#181818] hover:bg-[#222222] border border-neutral-800 hover:border-neutral-600 flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img src={p.thumbUrl || p.imageUrl} alt="" className="w-9 h-12 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900" />
                <div className="truncate">
                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">{p.categoria}</span>
                  <span className="font-bold text-xs text-white block truncate">{p.titulo}</span>
                  <span className="text-[10px] text-neutral-400 block truncate">{p.subtitulo || ''}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-black text-emerald-400 block">Q{p.precioMinimo}</span>
                <span className="text-[9px] text-neutral-300 font-semibold">Seleccionar</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
