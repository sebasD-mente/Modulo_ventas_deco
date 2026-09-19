import React from 'react';
import { Clock, Flame, TrendingUp } from 'lucide-react';

export default function HourlySalesCard({ data }) {
  if (!data) return null;
  const { eventName, date, totalAmount, totalTransactions, peakWindow, peakAmount, peakPercentage, hourlyBreakdown = [] } = data;

  return (
    <div className="mt-3 p-3.5 rounded-2xl bg-black/95 border border-neutral-700/80 shadow-xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Ventas por Horario
        </span>
        <span className="text-[10px] text-neutral-400 truncate max-w-[150px]">
          {eventName || 'Evento Activo'} {date ? `• ${date}` : ''}
        </span>
      </div>

      {/* Peak Window Banner */}
      {peakWindow && peakWindow !== 'Sin registros aún' && (
        <div className="flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-amber-950/50 via-emerald-950/40 to-neutral-900 border border-amber-500/30 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <Flame className="w-3.5 h-3.5" />
            </span>
            <div>
              <span className="text-[9px] text-neutral-400 block font-semibold uppercase">Horario de Mayor Venta</span>
              <strong className="text-white text-xs font-black">{peakWindow}</strong>
            </div>
          </div>
          <div className="text-right">
            <strong className="text-emerald-400 font-black block text-xs">Q {Number(peakAmount || 0).toFixed(2)}</strong>
            <span className="text-[9px] text-amber-300 font-bold">{peakPercentage}% del día</span>
          </div>
        </div>
      )}

      {/* Hourly Bar Chart */}
      {hourlyBreakdown.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          {hourlyBreakdown.map((item) => {
            const widthPct = Math.max(8, Math.min(100, item.percentage || 0));
            return (
              <div key={item.hour} className="group flex items-center gap-2 text-xs">
                {/* Hour Label */}
                <span className={`w-16 text-[10px] font-mono shrink-0 ${item.isPeak ? 'text-amber-400 font-black' : 'text-neutral-400'}`}>
                  {item.label}
                </span>

                {/* Progress Bar Container */}
                <div className="flex-1 bg-neutral-900 rounded-full h-3.5 overflow-hidden p-0.5 relative border border-neutral-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 flex items-center justify-end pr-1.5 ${
                      item.isPeak
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_8px_rgba(52,211,153,0.35)]'
                        : 'bg-gradient-to-r from-neutral-700 to-neutral-600'
                    }`}
                    style={{ width: `${widthPct}%` }}
                  >
                    {widthPct >= 20 && (
                      <span className="text-[8px] font-bold text-black select-none">
                        {item.percentage}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="w-24 text-right shrink-0 flex items-center justify-end gap-1">
                  <strong className={`text-[11px] font-mono ${item.isPeak ? 'text-emerald-400 font-black' : 'text-white'}`}>
                    Q{Number(item.amount || 0).toFixed(0)}
                  </strong>
                  <span className="text-[9px] text-neutral-500 font-mono">
                    ({item.count}v)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-3 text-neutral-500 text-xs">
          No hay transacciones registradas en este horario aún.
        </div>
      )}

      {/* Footer Totals */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-[10px] text-neutral-400 px-0.5">
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-emerald-400" /> Total Acumulado:
        </span>
        <span className="font-mono text-white">
          <strong className="text-emerald-400 font-black">Q {Number(totalAmount || 0).toFixed(2)}</strong> ({totalTransactions || 0} ventas)
        </span>
      </div>
    </div>
  );
}
