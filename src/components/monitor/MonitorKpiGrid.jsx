import React from 'react';

export default function MonitorKpiGrid({
  mode = 'event',
  transactions = 0,
  totalSold = 0,
  lastSale = null,
}) {
  if (mode === 'general') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="p-4 rounded-2xl bg-black border border-neutral-800">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
            Total de transacciones
          </span>
          <span className="text-2xl font-black text-white font-mono">
            {transactions || 0}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-black border border-neutral-800">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
            Total vendido general
          </span>
          <span className="text-2xl font-black text-emerald-400 font-mono">
            Q {Number(totalSold || 0).toFixed(2)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      <div className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
          Transacciones
        </span>
        <span className="text-xl font-black text-white font-mono">
          {transactions || 0}
        </span>
      </div>

      <div className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
          Total Vendido
        </span>
        <span className="text-xl font-black text-emerald-400 font-mono">
          Q {Number(totalSold || 0).toFixed(2)}
        </span>
      </div>

      <div className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1 mb-1">
          Última Venta
        </span>
        <span className="text-sm font-black text-white font-mono">
          {lastSale ? (
            <>
              Q {Number(lastSale.amount || 0).toFixed(2)}{' '}
              <span className="text-[10px] text-neutral-400 font-normal">
                ({lastSale.time})
              </span>
            </>
          ) : (
            <span className="text-xs text-neutral-500 font-normal">
              Sin ventas
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
