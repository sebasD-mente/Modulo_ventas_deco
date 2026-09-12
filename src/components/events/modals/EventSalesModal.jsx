import React from 'react';
import { Eye, X, Loader2 } from 'lucide-react';

export default function EventSalesModal({ event, salesList, sales, isLoading, onClose }) {
  if (!event) return null;
  const list = salesList || sales || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#141414] border border-neutral-800 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-white">
        <div className="px-6 py-4 bg-[#181818] border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-white" />
              Ventas registradas: {event.name}
            </h3>
            <span className="text-xs text-neutral-400">
              Total Acumulado: <strong className="text-emerald-400 font-mono">Q {Number(event.totalSold || 0).toFixed(2)}</strong> ({list.length} transacciones)
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1 no-scrollbar text-xs">
          {isLoading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin mb-2" />
              <span className="text-neutral-400">Cargando ventas...</span>
            </div>
          ) : list.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              No hay ventas registradas todavía para este evento.
            </div>
          ) : (
            list.map((sale) => (
              <div
                key={sale.id}
                className="p-3.5 rounded-2xl bg-black border border-neutral-800 space-y-2 hover:border-neutral-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white text-xs">{sale.saleNumber}</span>
                  <span className="text-[10px] text-neutral-400">
                    {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(sale.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="space-y-1">
                  {sale.items?.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-neutral-300 text-[11px]">
                      <span>{it.quantity}x {it.description}</span>
                      <span className="font-semibold text-neutral-200 font-mono">Q {Number(it.subtotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#181818] border border-neutral-800 text-neutral-300">
                      {sale.payments?.[0]?.method || 'EFECTIVO'}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {sale.seller?.fullName || 'Vendedor'}
                    </span>
                  </div>
                  <span className="font-extrabold text-emerald-400 text-sm font-mono">
                    Q {Number(sale.totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-3.5 bg-[#181818] border-t border-neutral-800 flex justify-end">
          <button
            type="button" onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs cursor-pointer shadow-md transition-transform active:scale-95"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
