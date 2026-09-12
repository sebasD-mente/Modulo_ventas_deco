import React from 'react';
import { Package, Clock, Printer, CheckCircle2 } from 'lucide-react';

const STATUS_BORDER = {
  A_PRODUCCION: 'border-cyan-500/40 bg-cyan-950/10',
  SEPARADO: 'border-emerald-500/30',
  IMPRESO: 'border-neutral-800 opacity-60',
};

const STATUS_BADGE = {
  PENDIENTE: 'bg-amber-950 text-amber-300 border-amber-800/80',
  SEPARADO: 'bg-emerald-950 text-emerald-300 border-emerald-800/80',
  A_PRODUCCION: 'bg-cyan-950 text-cyan-300 border-cyan-800/80',
};

export default function ProductionOrderCard({
  item, isUpdating = false, isOp2Only = false, isSuperAdmin = false, onStatusChange,
}) {
  const status = item.productionStatus || 'PENDIENTE';
  const cardBorder = STATUS_BORDER[status] || 'border-neutral-800';
  const badgeColor = STATUS_BADGE[status] || 'bg-neutral-900 text-neutral-400 border-neutral-800';
  const timeStr = item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className={`bg-black border rounded-2xl p-3.5 sm:p-4 transition-all ${cardBorder}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
          {item.product?.imageUrl ? (
            <img src={item.product.imageUrl} alt={item.description} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Package className="w-6 h-6 text-neutral-600" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate">{item.description}</h4>
            {item.quantity > 1 && (
              <span className="bg-neutral-800 text-white font-black text-[10px] px-1.5 py-0.5 rounded-md">x{item.quantity}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400">
            <span className="font-semibold text-neutral-300">Ticket: #{item.sale?.saleNumber || 'S/N'}</span>
            <span>•</span>
            <span>{item.sale?.event?.name || 'Evento'}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-neutral-500" />{timeStr}</span>
          </div>
          {item.productionNotes && (
            <p className="text-[11px] text-neutral-400 italic bg-neutral-900/60 rounded px-2 py-0.5 border border-neutral-800">
              Nota: {item.productionNotes}
            </p>
          )}
          <div className="pt-1 flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColor}`}>
              {status.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-neutral-900 flex items-center justify-end gap-2 flex-wrap">
        {(!isOp2Only || isSuperAdmin) && (
          <>
            {status !== 'SEPARADO' && (
              <button type="button" disabled={isUpdating} onClick={() => onStatusChange(item.id, 'SEPARADO')} className="bg-emerald-600 hover:bg-emerald-500 text-black font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                <Package className="w-3.5 h-3.5" /><span>📦 Separar Stock</span>
              </button>
            )}
            {status !== 'A_PRODUCCION' && status !== 'IMPRESO' && (
              <button type="button" disabled={isUpdating} onClick={() => onStatusChange(item.id, 'A_PRODUCCION')} className="bg-white hover:bg-neutral-200 text-black font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                <Printer className="w-3.5 h-3.5 text-black" /><span>🖨️ A Producción</span>
              </button>
            )}
            {status !== 'PENDIENTE' && isSuperAdmin && (
              <button type="button" disabled={isUpdating} onClick={() => onStatusChange(item.id, 'PENDIENTE')} className="bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs px-2.5 py-2 rounded-xl border border-neutral-800 transition-all cursor-pointer">
                Revertir
              </button>
            )}
          </>
        )}
        {(isOp2Only || (isSuperAdmin && status === 'A_PRODUCCION')) && (
          <button type="button" disabled={isUpdating} onClick={() => onStatusChange(item.id, 'IMPRESO')} className="w-full sm:w-auto bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
            <CheckCircle2 className="w-4 h-4 text-black" /><span>✅ Marcar como IMPRESO (Archivar)</span>
          </button>
        )}
      </div>
    </div>
  );
}
