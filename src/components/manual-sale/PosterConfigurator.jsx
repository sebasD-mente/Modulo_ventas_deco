import React from 'react';
import { DEFAULT_SIZES } from './manualSaleConstants';
import { X, Plus, Minus, ShoppingBag } from 'lucide-react';

export default function PosterConfigurator({
  selectedPoster,
  selectedSize,
  setSelectedSize,
  itemQuantity = 1,
  setItemQuantity,
  onAddToCart,
  onCancel,
}) {
  if (!selectedPoster) return null;

  return (
    <div className="p-4 rounded-2xl bg-black border border-neutral-700 space-y-3.5 animate-fadeIn">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={selectedPoster.thumbUrl || selectedPoster.imageUrl}
            alt=""
            className="w-12 h-16 object-cover rounded-lg border border-neutral-700 shadow-md shrink-0 bg-neutral-900"
          />
          <div>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
              {selectedPoster.categoria || 'ARTE'}
            </span>
            <h4 className="font-bold text-sm text-white">{selectedPoster.titulo}</h4>
            {selectedPoster.subtitulo && (
              <p className="text-xs text-neutral-400">{selectedPoster.subtitulo}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-neutral-400 hover:text-white p-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
          <ShoppingBag className="w-3.5 h-3.5 text-white" /> Desplegar Tamaño y Precio:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(selectedPoster.sizes || DEFAULT_SIZES).map((sz) => {
            const isSelected = selectedSize?.sizeId === sz.sizeId;
            return (
              <button
                key={sz.sizeId}
                type="button"
                onClick={() => setSelectedSize && setSelectedSize(sz)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-black border-white shadow-md font-black'
                    : 'bg-[#181818] border-neutral-800 text-neutral-300 hover:border-neutral-600'
                }`}
              >
                <span className="text-xs font-bold block">{sz.nombre || sz.sizeId}</span>
                <span
                  className={`text-xs ${
                    isSelected ? 'text-black font-black' : 'text-emerald-400 font-extrabold'
                  }`}
                >
                  Q {Number(sz.precio).toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-400">Cantidad:</span>
          <div className="flex items-center gap-1 bg-[#181818] px-2 py-1 rounded-lg border border-neutral-700">
            <button
              type="button"
              onClick={() => setItemQuantity && setItemQuantity(Math.max(1, itemQuantity - 1))}
              className="text-neutral-400 hover:text-white p-0.5 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-6 text-center font-bold text-sm text-white">{itemQuantity}</span>
            <button
              type="button"
              onClick={() => setItemQuantity && setItemQuantity(itemQuantity + 1)}
              className="text-neutral-400 hover:text-white p-0.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddToCart}
          className="px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar al Ticket (Q {(itemQuantity * (selectedSize?.precio || 0)).toFixed(2)})</span>
        </button>
      </div>
    </div>
  );
}
