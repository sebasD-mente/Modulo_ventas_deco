import React from 'react';
import { Clock, Edit, CreditCard, Smartphone, Banknote } from 'lucide-react';

function isSaleFromToday(dateStr) {
  if (!dateStr) return false;
  const fmt = (dt) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date(dt));
  return fmt(dateStr) === fmt(new Date());
}

function formatSaleTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const fmt = (dt) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(dt);
  const isToday = fmt(d) === fmt(new Date());
  const timeStr = d.toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit' });
  if (isToday) return timeStr;
  const dayStr = d.toLocaleDateString('es-GT', { timeZone: 'America/Guatemala', day: 'numeric', month: 'short' });
  return `${dayStr}, ${timeStr}`;
}

function getPaymentBadge(method) {
  if (method === 'TARJETA') {
    return <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold text-[10px] flex items-center gap-1"><CreditCard className="w-3 h-3" /> Tarjeta</span>;
  }
  if (method === 'TRANSFERENCIA') {
    return <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold text-[10px] flex items-center gap-1"><Smartphone className="w-3 h-3" /> Transferencia</span>;
  }
  return <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] flex items-center gap-1"><Banknote className="w-3 h-3" /> Efectivo</span>;
}

export default function RecentSaleRow({ sale, onEdit }) {
  return (
    <div className="p-3.5 rounded-2xl bg-black border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-black text-amber-400 text-xs">{sale.saleNumber}</span>
          <span className="text-slate-500 flex items-center gap-1 text-[11px]">
            <Clock className="w-3 h-3 text-slate-500" />
            {formatSaleTime(sale.createdAt)}
          </span>
          {getPaymentBadge(sale.payments?.[0]?.method)}
          {sale.notes && (
            <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded italic truncate max-w-[200px]">
              Nota: {sale.notes}
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-300 space-y-0.5">
          {(sale.items || []).map((it, idx) => (
            <div key={idx} className="flex items-center justify-between text-slate-300">
              <span className="truncate pr-2">• {it.quantity}x {it.description}</span>
              <span className="font-mono text-slate-400 shrink-0">Q {Number(it.subtotal).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 shrink-0">
        <div className="text-left sm:text-right">
          <span className="text-[10px] text-slate-500 block sm:inline mr-1">Total:</span>
          <span className="font-mono font-black text-emerald-400 text-sm">
            Q {Number(sale.totalAmount).toFixed(2)}
          </span>
        </div>
        {isSaleFromToday(sale.createdAt) ? (
          <button type="button" onClick={() => onEdit(sale)} className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm" title="Editar venta de la jornada actual">
            <Edit className="w-3.5 h-3.5" /><span>Editar</span>
          </button>
        ) : (
          <span className="px-2.5 py-1 rounded-lg bg-neutral-900 text-neutral-500 border border-neutral-800 text-[11px] font-semibold select-none" title="Las ventas de días anteriores están archivadas y son inmutables">
            Cerrada
          </span>
        )}
      </div>
    </div>
  );
}
