import React from 'react';
import { ShoppingBag, RefreshCw, Trash2, Plus, Minus } from 'lucide-react';
import { DEFAULT_EVENT_SIZES } from './chatConstants';

export default function DraftItemRow({
  item, index, onUpdateSize, onUpdateQty, onRemoveItem, onOpenSwap, availableSizes,
}) {
  const itemSizes = availableSizes || (Array.isArray(item.availableSizes) && item.availableSizes.length > 0 ? item.availableSizes : DEFAULT_EVENT_SIZES);
  const currentSize = itemSizes.find((s) => s.sizeId === item.sizeId) || itemSizes[0];

  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black border border-neutral-800 text-xs">
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
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={item.sizeId || currentSize?.sizeId}
            onChange={(e) => onUpdateSize?.(index, e.target.value)}
            className="min-h-[36px] bg-[#222222] border border-neutral-700 rounded-lg px-2 py-1 text-[11px] font-bold text-white focus:outline-none focus:border-white cursor-pointer"
          >
            {itemSizes.map((s) => (
              <option key={s.sizeId} value={s.sizeId}>{s.nombre} (Q{s.precio})</option>
            ))}
          </select>
          <div className="flex items-center gap-1 bg-[#222] border border-neutral-700 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => onUpdateQty?.(index, -1)}
              className="min-h-[36px] min-w-[36px] h-9 w-9 flex items-center justify-center text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 active:scale-95 transition-transform cursor-pointer"
              title="Disminuir cantidad"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-bold text-xs text-white px-1 min-w-[20px] text-center">{item.quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQty?.(index, 1)}
              className="min-h-[36px] min-w-[36px] h-9 w-9 flex items-center justify-center text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 active:scale-95 transition-transform cursor-pointer"
              title="Aumentar cantidad"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {onOpenSwap && (
            <button
              type="button"
              onClick={() => onOpenSwap(index)}
              className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 underline cursor-pointer min-h-[36px] px-1"
            >
              <RefreshCw className="w-3 h-3 text-emerald-400" />
              Cambiar diseño
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
