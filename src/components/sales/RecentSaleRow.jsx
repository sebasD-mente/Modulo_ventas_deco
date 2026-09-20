import React from 'react';
import { Clock, Edit, CreditCard, Smartphone, Banknote, Image as ImageIcon } from 'lucide-react';

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
  if (method === 'TARJETA') return <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold text-[10px] flex items-center gap-1"><CreditCard className="w-3 h-3" /> Tarjeta</span>;
  if (method === 'TRANSFERENCIA') return <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold text-[10px] flex items-center gap-1"><Smartphone className="w-3 h-3" /> Transferencia</span>;
  return <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] flex items-center gap-1"><Banknote className="w-3 h-3" /> Efectivo</span>;
}

export default function RecentSaleRow({ sale, onEdit, onBalancePayment, onShareWhatsApp }) {
  const hasBalance = Number(sale.balanceDue || 0) > 0;

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
          {sale.orderType === 'REDES_PERSONALIZADO' && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold text-[10px] flex items-center gap-1">
              📱 Redes
            </span>
          )}
          {hasBalance && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[10px] flex items-center gap-1">
              ⏳ Saldo: Q {Number(sale.balanceDue).toFixed(2)}
            </span>
          )}
          {(sale.customer?.fullName || sale.customerName) && (
            <span className="text-[10px] text-neutral-300 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded font-semibold truncate max-w-[150px]">
              👤 {sale.customer?.fullName || sale.customerName}
            </span>
          )}
          {sale.notes && (
            <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded italic truncate max-w-[200px]">
              Nota: {sale.notes}
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-300 space-y-1 pt-0.5">
          {(sale.items || []).map((it, idx) => {
            const img = it.product?.imageUrl || it.imageUrl || it.thumbUrl;
            return (
              <div key={idx} className="flex items-center justify-between gap-2 text-slate-300">
                <div className="flex items-center gap-2 min-w-0">
                  {img ? (
                    <img src={img} alt={it.description} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover bg-neutral-900 border border-neutral-800 shrink-0" />
                  ) : (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-neutral-900 border border-neutral-800 shrink-0 flex items-center justify-center text-neutral-600">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  )}
                  <span className="truncate">{it.quantity}x {it.description}</span>
                </div>
                <span className="font-mono text-slate-400 shrink-0">Q {Number(it.subtotal).toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 shrink-0 flex-wrap">
        <div className="text-left sm:text-right mr-1">
          <span className="text-[10px] text-slate-500 block sm:inline mr-1">Total:</span>
          <span className="font-mono font-black text-emerald-400 text-sm">
            Q {Number(sale.totalAmount).toFixed(2)}
          </span>
        </div>

        {/* Botón Cobrar Saldo (Habilitado siempre que haya saldo pendiente) */}
        {hasBalance && onBalancePayment && (
          <button
            type="button"
            onClick={() => onBalancePayment(sale)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Cobrar saldo pendiente de entrega"
          >
            <Banknote className="w-4 h-4" />
            <span>Cobrar Saldo</span>
          </button>
        )}

        {/* Botón Compartir WhatsApp */}
        {onShareWhatsApp && (
          <button
            type="button"
            onClick={() => onShareWhatsApp(sale)}
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 font-bold text-xs flex items-center justify-center transition-all cursor-pointer shadow-sm"
            title="Compartir comprobante por WhatsApp"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        )}

        {isSaleFromToday(sale.createdAt) ? (
          <button
            type="button"
            onClick={() => onEdit(sale)}
            className="min-h-[44px] px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Editar venta de la jornada actual"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Editar</span>
          </button>
        ) : (
          <span className="min-h-[44px] px-2.5 py-1 rounded-xl bg-neutral-900 text-neutral-500 border border-neutral-800 text-[11px] font-semibold flex items-center select-none" title="Las ventas de días anteriores están archivadas y son inmutables">
            Cerrada
          </span>
        )}
      </div>
    </div>
  );
}
