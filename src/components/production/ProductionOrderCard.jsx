import React from 'react';
import { Package, Clock, Printer, CheckCircle2, ExternalLink, Scissors } from 'lucide-react';

const STATUS_BORDER = { A_PRODUCCION: 'border-cyan-500/40 bg-cyan-950/10', SEPARADO: 'border-emerald-500/30', IMPRESO: 'border-neutral-800 opacity-60' };
const STATUS_BADGE = { PENDIENTE: 'bg-amber-950 text-amber-300 border-amber-800/80', SEPARADO: 'bg-emerald-950 text-emerald-300 border-emerald-800/80', A_PRODUCCION: 'bg-cyan-950 text-cyan-300 border-cyan-800/80' };

export default function ProductionOrderCard({
  item, isUpdating = false, isOp2Only = false, isSuperAdmin = false, isVendedorRedesOnly = false, onStatusChange,
}) {
  const status = item.productionStatus || 'PENDIENTE';
  const cardBorder = STATUS_BORDER[status] || 'border-neutral-800';
  const badgeColor = STATUS_BADGE[status] || 'bg-neutral-900 text-neutral-400 border-neutral-800';
  const timeStr = item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const artUrl = item.customImageUrl || item.product?.imageUrl;
  const isWorkshopCut = item.isCustom || item.customDimensions?.toLowerCase().includes('corte taller') || item.description?.toLowerCase().includes('corte taller');

  return (
    <div className={`bg-black border rounded-2xl p-3.5 sm:p-4 transition-all ${cardBorder}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="relative group w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
          {artUrl ? (
            <>
              <img src={artUrl} alt={item.description} className="w-full h-full object-cover" loading="lazy" />
              <a href={artUrl} target="_blank" rel="noopener noreferrer" title="Abrir arte original en alta resolución para RIP de taller" className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-cyan-300 min-h-[44px] min-w-[44px]">
                <ExternalLink className="w-4 h-4" />
              </a>
            </>
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
          <div className="pt-1 flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColor}`}>
              {status.replace('_', ' ')}
            </span>
            {artUrl && (
              <a
                href={artUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir arte original en alta resolución para RIP de taller"
                className="text-[10px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-800/80 hover:border-cyan-400 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 transition-colors"
              >
                <ExternalLink className="w-3 h-3 text-cyan-400" />
                <span>Arte RIP</span>
              </a>
            )}
            {item.customDimensions && (
              <span className="text-[10px] font-semibold text-neutral-300 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                📏 {item.customDimensions}
              </span>
            )}
            {item.material && (
              <span className="bg-neutral-800 text-neutral-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                {item.material}
              </span>
            )}
            {isWorkshopCut && (
              <span className="bg-amber-950/80 text-amber-300 border border-amber-700/80 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                <Scissors className="w-3 h-3 text-amber-400" />
                <span>CORTE TALLER</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {!isVendedorRedesOnly && (
        <div className="mt-3 pt-3 border-t border-neutral-900 flex items-center justify-between gap-2 flex-wrap">
          {/* Desplegable reactivo de cambio de estado */}
          <select
            value={status}
            disabled={isUpdating}
            onChange={(e) => onStatusChange(item.id, e.target.value)}
            className="min-h-[44px] bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold cursor-pointer focus:outline-none focus:border-cyan-400"
          >
            <option value="A_PRODUCCION">🖨️ A Producción</option>
            <option value="IMPRESO">✅ Impreso</option>
            <option value="SEPARADO">📦 Separado (Stock)</option>
            <option value="PENDIENTE">⏳ Pendiente</option>
          </select>

          {/* Botones de acción rápida táctil */}
          <div className="flex items-center gap-2 flex-wrap">
            {status !== 'IMPRESO' && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onStatusChange(item.id, 'IMPRESO')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-black" />
                <span>✅ Marcar como IMPRESO</span>
              </button>
            )}
            {(!isOp2Only || isSuperAdmin) && (
              <>
                {status !== 'SEPARADO' && (
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => onStatusChange(item.id, 'SEPARADO')}
                    className="min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-black font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>📦 Separar Stock</span>
                  </button>
                )}
                {status !== 'A_PRODUCCION' && status !== 'IMPRESO' && (
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => onStatusChange(item.id, 'A_PRODUCCION')}
                    className="min-h-[44px] bg-white hover:bg-neutral-200 text-black font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5 text-black" />
                    <span>🖨️ A Producción</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
