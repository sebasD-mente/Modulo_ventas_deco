import React from 'react';
import { Plus, Minus, Trash2, Image as ImageIcon } from 'lucide-react';

export default function EditSaleItemsTable({ items, onUpdateQuantity, onRemoveItem }) {
  return (
    <div>
      <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-1.5">
        2. Pósters en la venta ({items.length})
      </label>
      <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
        {items.map((it, idx) => {
          const img = it.customImageUrl || it.product?.imageUrl || it.imageUrl || it.thumbUrl;
          return (
            <div
              key={it.id || idx}
              className="p-3 rounded-2xl bg-black border border-neutral-800 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {img ? (
                  <img src={img} alt={it.description} className="w-10 h-10 rounded-lg object-cover bg-neutral-900 border border-neutral-800 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 shrink-0 flex items-center justify-center text-neutral-600">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-white block truncate">{it.description}</span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Precio unitario: Q {Number(it.unitPrice).toFixed(2)}
                  </span>
                </div>
              </div>

            {/* Stepper de cantidad */}
            <div className="flex items-center gap-1 bg-[#181818] px-2 py-1 rounded-lg border border-neutral-800 shrink-0">
              <button
                type="button"
                onClick={() => onUpdateQuantity(idx, -1)}
                className="text-neutral-400 hover:text-white cursor-pointer"
                title="Disminuir cantidad"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-4 text-center font-bold text-white">{it.quantity}</span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(idx, 1)}
                className="text-neutral-400 hover:text-white cursor-pointer"
                title="Aumentar cantidad"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-right shrink-0 min-w-[65px]">
              <span className="font-mono font-bold text-emerald-400 block">
                Q {(it.quantity * it.unitPrice).toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onRemoveItem(idx)}
              className="text-neutral-500 hover:text-red-400 p-1 cursor-pointer shrink-0"
              title="Eliminar este ítem"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      </div>
    </div>
  );
}
