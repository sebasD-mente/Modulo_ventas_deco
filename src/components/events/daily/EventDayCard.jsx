import React from 'react';
import { ChevronDown, CheckCircle2, AlertTriangle, Clock, Lock, Banknote, CreditCard, Smartphone, Image as ImageIcon } from 'lucide-react';

function ClosingBadge({ closing, isToday }) {
  if (closing?.closingType === 'DIARIO') {
    const diff = Number(closing.cashDifference || 0);
    const isCuadrada = Math.abs(diff) < 0.01;
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
        <CheckCircle2 className="w-3 h-3 shrink-0" />
        🟢 Cierre oficial ({isCuadrada ? 'Conciliado' : `Dif: Q ${diff.toFixed(2)}`})
      </span>
    );
  }
  if (closing?.closingType === 'AUTOMATICO_MEDIANOCHE') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/40 text-amber-400" title="Cierre automático del sistema a medianoche">
        <AlertTriangle className="w-3 h-3 shrink-0 text-amber-400" />
        ⚠️ Cierre no oficial (Automático)
      </span>
    );
  }
  if (isToday) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 border border-blue-500/30 text-blue-400">
        <Clock className="w-3 h-3 shrink-0" />
        🔵 Jornada en curso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 border border-neutral-700 text-neutral-400">
      <Lock className="w-3 h-3 shrink-0" />
      🔒 Jornada cerrada
    </span>
  );
}

export default function EventDayCard({ dayData, isExpanded, onToggleExpand }) {
  const { formattedDate, totalSold, salesCount, paymentTotals, closing, isToday, sales } = dayData;

  return (
    <div className="rounded-2xl bg-neutral-900/90 border border-neutral-800 overflow-hidden transition-all hover:border-neutral-700">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full p-4 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer bg-[#141414] hover:bg-[#181818] transition-colors"
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white text-sm capitalize">{formattedDate}</span>
            <ClosingBadge closing={closing} isToday={isToday} />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-400 flex-wrap">
            <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-neutral-800">
              <Banknote className="w-3 h-3 text-emerald-400" /> Q {Number(paymentTotals?.EFECTIVO || 0).toFixed(2)}
            </span>
            <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-neutral-800">
              <CreditCard className="w-3 h-3 text-blue-400" /> Q {Number(paymentTotals?.TARJETA || 0).toFixed(2)}
            </span>
            <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-neutral-800">
              <Smartphone className="w-3 h-3 text-purple-400" /> Q {Number(paymentTotals?.TRANSFERENCIA || 0).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-800">
          <div className="text-left sm:text-right">
            <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
              Q {Number(totalSold || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-neutral-400 block font-normal">
              ({salesCount} {salesCount === 1 ? 'venta' : 'ventas'})
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-white' : ''}`} />
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 sm:p-4 bg-black/70 border-t border-neutral-800/80 space-y-2.5">
          {sales.map((sale) => {
            const timeStr = new Date(sale.createdAt).toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit' });
            return (
              <div key={sale.id} className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400 text-xs">{sale.saleNumber}</span>
                    <span className="text-neutral-400 text-[11px]">{timeStr}</span>
                    <span className="text-neutral-400 text-[11px]">• {sale.seller?.fullName || 'Vendedor'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-900 border border-neutral-800 text-neutral-300">
                      {sale.payments?.[0]?.method || 'EFECTIVO'}
                    </span>
                    <span className="font-mono font-black text-emerald-400 text-xs">
                      Q {Number(sale.totalAmount).toFixed(2)}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-900 border border-neutral-800 text-neutral-500">
                      Inmutable / Cerrada
                    </span>
                  </div>
                </div>

                <div className="space-y-1 pt-1.5 border-t border-neutral-900">
                  {(sale.items || []).map((it, idx) => {
                    const img = it.product?.imageUrl || it.imageUrl || it.thumbUrl;
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2 text-xs text-neutral-300">
                        <div className="flex items-center gap-2 min-w-0">
                          {img ? (
                            <img src={img} alt={it.description} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover bg-neutral-900 border border-neutral-800 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-neutral-900 border border-neutral-800 shrink-0 flex items-center justify-center text-neutral-600">
                              <ImageIcon className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <span className="truncate">{it.quantity}x {it.description}</span>
                        </div>
                        <span className="font-mono text-neutral-400 shrink-0">Q {Number(it.subtotal).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
