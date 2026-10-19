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
        <div className="space-y-2.5 max-h-80 overflow-y-auto no-scrollbar">
          {cartItems.map((item) => {
            const imgUrl = item.customImageUrl || item.thumbUrl || item.imageUrl;
            const sizes = Array.isArray(item.availableSizes) && item.availableSizes.length > 0 ? item.availableSizes : DEFAULT_SIZES;
            return (
              <div key={item.id} className="p-3 sm:p-3.5 rounded-2xl bg-black border border-neutral-800 flex flex-col gap-2.5 text-xs">
                {/* Cabecera: Arte, Título y Eliminar */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {imgUrl ? (
                      <img src={imgUrl} alt="" className="w-10 h-13 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900" />
                    ) : (
                      <div className="w-10 h-13 rounded-lg border border-neutral-800 bg-neutral-900 flex items-center justify-center shrink-0 text-neutral-600">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                    )}
                    <span className="font-bold text-white block truncate text-xs sm:text-sm">{item.description}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveItem && onRemoveItem(item.id)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-500 hover:text-red-400 p-2 rounded-xl hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                    title="Eliminar este póster del ticket"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Tamaños disponibles (Scroll horizontal limpio de 1 toque) */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {sizes.length <= 1 ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      {sizes[0]?.nombre || sizes[0]?.sizeId || 'Portada de Álbum'} (Q{sizes[0]?.precio || item.unitPrice})
                    </span>
                  ) : (
                    sizes.map((sz) => {
                      const isSel = item.selectedSizeId ? item.selectedSizeId === sz.sizeId : item.unitPrice === sz.precio;
                      return (
                        <button
                          key={sz.sizeId}
                          type="button"
                          onClick={() => onChangeSize && onChangeSize(item.id, sz)}
                          className={`min-h-[44px] min-w-[44px] px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors flex items-center justify-center shrink-0 ${
                            isSel ? 'bg-white text-black shadow-sm' : 'bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800'
                          }`}
                        >
                          {sz.nombre || sz.sizeId} (Q{sz.precio})
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Barra Inferior: Selector de Cantidad y Subtotal */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-900">
                  <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-xl border border-neutral-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateQty && onUpdateQty(item.id, -1)}
                      className="min-w-[44px] min-h-[44px] rounded-lg bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white flex items-center justify-center font-bold text-base cursor-pointer active:scale-95 transition-all"
                      title="Disminuir cantidad"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-7 text-center font-bold text-sm text-white">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty && onUpdateQty(item.id, 1)}
                      className="min-w-[44px] min-h-[44px] rounded-lg bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white flex items-center justify-center font-bold text-base cursor-pointer active:scale-95 transition-all"
                      title="Aumentar cantidad"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-neutral-400 block font-medium">Subtotal</span>
                    <span className="font-extrabold text-emerald-400 text-sm sm:text-base">Q {Number(item.subtotal || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
