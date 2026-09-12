import React from 'react';
import { DEFAULT_SIZES } from './manualSaleConstants';
import { ShoppingBag, Plus, Minus, Trash2, X } from 'lucide-react';

export default function SaleCartList({
  cartItems = [],
  attachments = [],
  inputChannel,
  onUnlinkAttachments,
  onUpdateQty,
  onChangeSize,
  onRemoveItem,
  onClearCart,
}) {
  return (
    <div className="space-y-2">
      {(attachments?.length > 0 || (inputChannel && inputChannel !== 'MANUAL_RAPIDA')) && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <span className="font-bold">✨ Borrador transferido desde {inputChannel}</span>
            {attachments.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px] font-semibold">
                📎 {attachments.length} archivo(s) adjunto(s)
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onUnlinkAttachments}
            className="text-neutral-400 hover:text-white text-[11px] underline cursor-pointer flex items-center gap-1"
          >
            <span>Desvincular</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
        <span>2. Pósters en la Venta ({cartItems.length})</span>
        {cartItems.length > 0 && (
          <button
            type="button"
            onClick={onClearCart}
            className="text-[11px] text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
          >
            Limpiar Venta
          </button>
        )}
      </label>

      {cartItems.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-neutral-800 text-center text-xs text-neutral-500">
          <ShoppingBag className="w-6 h-6 mx-auto mb-1 text-neutral-600" />
          <span>No hay pósters agregados todavía. Llama una obra arriba para agregarla a esta venta.</span>
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
          {cartItems.map((item) => (
            <div key={item.id} className="p-3 rounded-2xl bg-black border border-neutral-800 flex items-center justify-between gap-3 text-xs">
              {item.thumbUrl && (
                <img src={item.thumbUrl} alt="" className="w-9 h-12 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900" />
              )}

              <div className="flex-1 min-w-0">
                <span className="font-semibold text-white block truncate">{item.description}</span>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {(item.availableSizes || DEFAULT_SIZES).map((sz) => {
                    const isSel = item.selectedSizeId ? item.selectedSizeId === sz.sizeId : item.unitPrice === sz.precio;
                    return (
                      <button
                        key={sz.sizeId}
                        type="button"
                        onClick={() => onChangeSize && onChangeSize(item.id, sz)}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                          isSel ? 'bg-white text-black' : 'bg-[#181818] text-neutral-400 hover:text-white'
                        }`}
                      >
                        {sz.nombre || sz.sizeId} (Q{sz.precio})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-1 bg-[#181818] px-2 py-1 rounded-lg border border-neutral-800 shrink-0">
                <button type="button" onClick={() => onUpdateQty && onUpdateQty(item.id, -1)} className="text-neutral-400 hover:text-white cursor-pointer">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-4 text-center font-bold text-white">{item.quantity}</span>
                <button type="button" onClick={() => onUpdateQty && onUpdateQty(item.id, 1)} className="text-neutral-400 hover:text-white cursor-pointer">
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="text-right shrink-0 pl-1">
                <span className="font-bold text-emerald-400 block">Q {Number(item.subtotal || 0).toFixed(2)}</span>
              </div>

              <button type="button" onClick={() => onRemoveItem && onRemoveItem(item.id)} className="text-neutral-500 hover:text-red-400 p-1 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
