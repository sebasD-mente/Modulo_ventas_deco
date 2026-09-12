import React from 'react';
import { Minus, Plus, RotateCcw, Banknote, Coins } from 'lucide-react';
import { DENOMINATIONS } from './hooks/useCashClosing';

export default function CashDenominationGrid({
  counts = {}, updateCount, resetCounts, denomTotal = 0,
}) {
  return (
    <div className="bg-black/60 p-4 sm:p-5 rounded-2xl border border-neutral-800 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
          <Banknote className="w-4 h-4 text-emerald-400" />
          Desglose por denominación (Billetes y Monedas)
        </span>
        <button
          type="button"
          onClick={resetCounts}
          className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 transition cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reiniciar</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {DENOMINATIONS.map(({ value, label, type }) => {
          const count = counts[value] || 0;
          const subtotal = count * value;
          return (
            <div key={value} className="bg-[#161616] p-2.5 rounded-xl border border-neutral-800 flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-black text-white font-mono flex items-center gap-1">
                  {type === 'moneda' ? <Coins className="w-3 h-3 text-amber-400" /> : null}
                  {label}
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  Q {subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateCount(value, (c) => Math.max(0, c - 1))}
                  className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center font-bold text-xs cursor-pointer active:scale-95 transition"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={count || ''}
                  placeholder="0"
                  onChange={(e) => updateCount(value, Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="flex-1 min-w-0 bg-black text-center border border-neutral-700 rounded-lg py-1 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => updateCount(value, (c) => c + 1)}
                  className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center font-bold text-xs cursor-pointer active:scale-95 transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-xs">
        <span className="text-neutral-400">Total en Gaveta (Contado):</span>
        <span className="font-mono font-black text-base text-emerald-400">Q {denomTotal.toFixed(2)}</span>
      </div>
    </div>
  );
}
