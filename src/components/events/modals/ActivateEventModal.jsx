import React from 'react';
import { Play, X, Mail, User, Loader2, CheckCircle, Users } from 'lucide-react';

export default function ActivateEventModal({
  event, onClose, sellerGoogleEmail, setSellerGoogleEmail, sellerName, setSellerName, onConfirm, isSubmitting,
}) {
  if (!event) return null;

  const sellers = event.assignedSellers || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#141414] border border-neutral-800 rounded-[32px] w-full max-w-md p-6 shadow-2xl space-y-4 text-white">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-400" />
            Poner evento "En curso"
          </h3>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-black border border-neutral-800 text-xs text-neutral-300 space-y-1">
          <span className="font-bold text-white block">{event.name}</span>
          <span className="text-neutral-400 block">{event.location}</span>
        </div>

        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 leading-relaxed">
          ⚡ <strong>Activación Concurrente:</strong> Este stand operará en simultáneo. Los demás eventos activos continuarán operando sin interrupción.
        </div>

        {sellers.length > 0 ? (
          <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1.5 text-xs">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Vendedores asignados a este stand ({sellers.length}):</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto no-scrollbar">
              {sellers.map((s) => (
                <span key={s.id} className="px-2 py-0.5 rounded bg-black border border-neutral-800 text-[11px] text-neutral-200">
                  {s.fullName}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                Correo del vendedor encargado (Opcional)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email" placeholder="ej. vendedor@decovintage.online"
                  value={sellerGoogleEmail || ''}
                  onChange={(e) => setSellerGoogleEmail(e.target.value)}
                  className="w-full bg-black border border-neutral-700/90 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                Nombre del vendedor (Opcional)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text" placeholder="ej. Carlos Pérez"
                  value={sellerName || ''}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="w-full bg-black border border-neutral-700/90 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner min-h-[44px]"
                />
              </div>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
          <button
            type="button" onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 text-xs font-bold hover:text-white hover:border-neutral-700 cursor-pointer min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            type="button" onClick={onConfirm}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer transition-transform active:scale-95 min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Activando stand...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Confirmar y poner en curso</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
