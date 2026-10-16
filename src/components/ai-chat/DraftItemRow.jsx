import React from 'react';
import { ShoppingBag, RefreshCw, Trash2, Plus, Minus } from 'lucide-react';
import { DEFAULT_EVENT_SIZES } from './chatConstants';

export default function DraftItemRow({
  item, index, onUpdateSize, onUpdateQty, onRemoveItem, onOpenSwap, onSelectVariant, availableSizes,
}) {
  const itemSizes = availableSizes || (Array.isArray(item.availableSizes) && item.availableSizes.length > 0 ? item.availableSizes : DEFAULT_EVENT_SIZES);
  const currentSize = itemSizes.find((s) => s.sizeId === item.sizeId) || itemSizes[0];
  const alternatives = Array.isArray(item.alternatives) ? item.alternatives : [];

  return (
    <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-black border border-neutral-800 text-xs">
      <div className="flex items-center gap-2.5">
        {item.thumbUrl || item.imageUrl ? (
          <img src={item.thumbUrl || item.imageUrl} alt="" className="w-10 h-14 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900" />
        ) : (
          <div className="w-10 h-14 rounded-lg border border-neutral-800 bg-neutral-900 flex items-center justify-center shrink-0 text-neutral-600">
            <ShoppingBag className="w-4 h-4 text-neutral-600" />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className="font-bold text-white truncate">{item.baseTitle || item.description}</span>
              <span className="text-[9px] text-neutral-400 uppercase font-semibold bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded shrink-0">
                {item.category || 'ARTE'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-emerald-400 font-black text-xs">Q{(item.quantity * item.unitPrice).toFixed(2)}</span>
              <button
                type="button"
                onClick={() => onRemoveItem?.(index)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-500 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition-colors cursor-pointer"
                title="Eliminar este póster"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {itemSizes.map((s) => {
                const isSelected = (item.sizeId || currentSize?.sizeId) === s.sizeId;
                return (
                  <button
                    key={s.sizeId}
                    type="button"
                    onClick={() => onUpdateSize?.(index, s.sizeId)}
                    className={`min-h-[38px] px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-white text-black border-white shadow-sm'
                        : 'bg-[#222222] border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500'
                    }`}
                  >
                    <span>{s.nombre || s.sizeId}</span>
                    <span className={isSelected ? 'text-black font-extrabold' : 'text-emerald-400 font-extrabold'}>
                      (Q{s.precio})
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1 bg-[#222] border border-neutral-700 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => onUpdateQty?.(index, -1)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 active:scale-95 transition-transform cursor-pointer"
                title="Disminuir cantidad"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-bold text-xs text-white px-1 min-w-[20px] text-center">{item.quantity}</span>
              <button
                type="button"
                onClick={() => onUpdateQty?.(index, 1)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 active:scale-95 transition-transform cursor-pointer"
                title="Aumentar cantidad"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {onOpenSwap && (
              <button
                type="button"
                onClick={() => onOpenSwap(index)}
                className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 underline cursor-pointer min-h-[44px] px-2"
              >
                <RefreshCw className="w-3 h-3 text-emerald-400" />
                Cambiar diseño
              </button>
            )}
          </div>
        </div>
        {alternatives.length > 0 && (
        <div className="pt-1.5 border-t border-neutral-900 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-bold text-neutral-400 shrink-0">Otros diseños:</span>
          {alternatives.map((alt) => (
            <button
              key={alt.id || alt.posterId}
              type="button"
              onClick={() => (onSelectVariant ? onSelectVariant(index, alt) : onOpenSwap?.(index, alt.titulo))}
              className="min-h-[44px] px-2.5 py-1 rounded-xl bg-[#181818] hover:bg-emerald-950/40 border border-neutral-800 hover:border-emerald-500/60 flex items-center gap-2 shrink-0 transition-colors cursor-pointer"
              title={`Cambiar a ${alt.titulo}${alt.subtitulo ? ` - ${alt.subtitulo}` : ''}`}
            >
              {(alt.thumbUrl || alt.imageUrl) && (
                <img src={alt.thumbUrl || alt.imageUrl} alt="" className="w-6 h-8 object-cover rounded border border-neutral-700 shrink-0" />
              )}
              <span className="text-[10px] font-semibold text-neutral-200 max-w-[120px] truncate">
                {alt.subtitulo || alt.titulo}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
