import React from 'react';
import { BarChart3, Wallet, Users, Printer, Package } from 'lucide-react';

export default function ChatToolCards({ message, msg, onAddPosterToDraft, onAddPoster }) {
  const m = message || msg;
  if (!m) return null;
  const addFn = onAddPosterToDraft || onAddPoster;
  const { eventKpis: k, cashDrawerStatus: c, sellerShiftReport: s, productionQueueStatus: q, inventoryStock: inv, suggestedPosters: sps } = m;

  return (
    <>
      {k && (
        <div className="mt-3 p-3 rounded-2xl bg-black/90 border border-neutral-700 space-y-2.5">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" /> Métricas en Vivo
            </span>
            <span className="text-[10px] text-neutral-400 truncate max-w-[140px]">{k.event?.name || k.eventName || 'Evento Activo'}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-[#181818] p-2 rounded-xl"><span className="text-[9px] text-neutral-400 block">Total Vendido</span><strong className="text-xs sm:text-sm text-emerald-400 font-black">Q {Number(k.totalAmount || 0).toFixed(2)}</strong></div>
            <div className="bg-[#181818] p-2 rounded-xl"><span className="text-[9px] text-neutral-400 block">Ventas</span><strong className="text-xs sm:text-sm text-white font-black">{k.totalTransactions || 0}</strong></div>
            <div className="bg-[#181818] p-2 rounded-xl"><span className="text-[9px] text-neutral-400 block">Obras</span><strong className="text-xs sm:text-sm text-white font-black">{k.totalUnits || 0}</strong></div>
            <div className="bg-[#181818] p-2 rounded-xl"><span className="text-[9px] text-neutral-400 block">Ticket Promedio</span><strong className="text-xs sm:text-sm text-amber-400 font-black">Q {Number(k.averageTicket || 0).toFixed(2)}</strong></div>
          </div>
          {k.paymentBreakdown && (
            <div className="flex items-center justify-between text-[10px] text-neutral-400 px-1 pt-1 border-t border-neutral-800/80">
              <span>💵 Ef: Q{Number(k.paymentBreakdown.EFECTIVO?.amount || 0).toFixed(0)}</span><span>💳 Tarj: Q{Number(k.paymentBreakdown.TARJETA?.amount || 0).toFixed(0)}</span><span>🏦 Transf: Q{Number(k.paymentBreakdown.TRANSFERENCIA?.amount || 0).toFixed(0)}</span>
            </div>
          )}
        </div>
      )}
      {c && (
        <div className="mt-3 p-3 rounded-2xl bg-black/90 border border-neutral-700 space-y-2.5">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Estado de Gaveta</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">{c.lastClosing?.discrepancyStatus || 'SIN_ARQUEO'}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
            <div className="bg-[#181818] p-2 rounded-xl col-span-2 sm:col-span-1"><span className="text-[9px] text-neutral-400 block">Efectivo en Gaveta</span><strong className="text-xs sm:text-sm text-emerald-400 font-black">Q {Number(c.currentCashInDrawer || 0).toFixed(2)}</strong></div>
            <div className="bg-[#181818] p-2 rounded-xl"><span className="text-[9px] text-neutral-400 block">Ventas Tarjeta</span><strong className="text-xs sm:text-sm text-white font-black">Q {Number(c.totalCardInSales || 0).toFixed(2)}</strong></div>
            <div className="bg-[#181818] p-2 rounded-xl"><span className="text-[9px] text-neutral-400 block">Transferencias</span><strong className="text-xs sm:text-sm text-white font-black">Q {Number(c.totalTransferInSales || 0).toFixed(2)}</strong></div>
          </div>
          {c.lastClosing && (
            <div className="text-[10px] text-neutral-400 bg-neutral-900/80 p-2 rounded-xl border border-neutral-800">
              Último arqueo por <strong>{c.lastClosing.closedBy}</strong>: reportado Q{Number(c.lastClosing.reportedCash || 0).toFixed(2)} (Dif: Q{Number(c.lastClosing.difference || 0).toFixed(2)})
            </div>
          )}
        </div>
      )}
      {s && (
        <div className="mt-3 p-3 rounded-2xl bg-black/90 border border-neutral-700 space-y-2">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Desempeño de Vendedores</span>
            <span className="text-[10px] text-neutral-400">{s.eventName || 'Stand'}</span>
          </div>
          {s.seller ? (
            <div className="bg-[#181818] p-2.5 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-xs"><strong className="text-white">{s.seller.sellerName}</strong><span className="text-emerald-400 font-black">Q {Number(s.seller.totalAmount || 0).toFixed(2)}</span></div>
              <div className="text-[10px] text-neutral-400 flex justify-between"><span>{s.seller.transactionCount} ventas ({s.seller.unitsSold} obras)</span><span>Ticket Prom: Q{Number(s.seller.averageTicket || 0).toFixed(2)}</span></div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {(s.ranking || []).slice(0, 4).map((r) => (
                <div key={r.sellerId} className="flex items-center justify-between p-2 rounded-xl bg-[#181818] text-xs">
                  <span className="text-white truncate">{r.position === 1 ? '🥇' : r.position === 2 ? '🥈' : r.position === 3 ? '🥉' : '🎖️'} #{r.position} {r.sellerName}</span>
                  <span className="text-emerald-400 font-bold ml-2">Q {Number(r.totalAmount || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {q && (
        <div className="mt-3 p-3 rounded-2xl bg-black/90 border border-neutral-700 space-y-2">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1"><Printer className="w-3.5 h-3.5" /> Taller de Impresión</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${q.health === 'OPTIMO' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : q.health === 'MODERADO' ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-red-950 text-red-400 border border-red-800'}`}>{q.health || 'OPERANDO'}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="bg-[#181818] p-1.5 rounded-xl"><span className="text-[8px] text-cyan-400 block font-bold">A Taller</span><strong className="text-xs text-white">{q.counts?.inProduction || 0}</strong></div>
            <div className="bg-[#181818] p-1.5 rounded-xl"><span className="text-[8px] text-amber-400 block font-bold">Pendiente</span><strong className="text-xs text-white">{q.counts?.pending || 0}</strong></div>
            <div className="bg-[#181818] p-1.5 rounded-xl"><span className="text-[8px] text-emerald-400 block font-bold">Stock</span><strong className="text-xs text-white">{q.counts?.separated || 0}</strong></div>
            <div className="bg-[#181818] p-1.5 rounded-xl"><span className="text-[8px] text-neutral-400 block font-bold">Impresos</span><strong className="text-xs text-white">{q.counts?.printed || 0}</strong></div>
          </div>
          <div className="text-[10px] text-neutral-400 flex justify-between px-1">
            <span>Espera prom: ~{q.timing?.averageQueueWaitMinutes || 0} min</span>
            {q.stalledCount > 0 && <span className="text-amber-400 font-bold">⚠️ {q.stalledCount} rezagos</span>}
          </div>
        </div>
      )}
      {inv && (
        <div className="mt-3 p-3 rounded-2xl bg-black/90 border border-neutral-700 space-y-2">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Disponibilidad en Stand</span>
            <span className="text-[10px] text-emerald-400 font-bold">{inv.stockAvailability?.standPhysicalStock === 'DISPONIBLE_MOSTRADOR' ? '⚡ Entrega Inmediata' : '🖨️ En Taller (~12m)'}</span>
          </div>
          {inv.artwork && (
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#181818]">
              <img src={inv.artwork.thumbUrl || inv.artwork.imageUrl} alt={inv.artwork.title} className="w-10 h-14 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900" />
              <div className="flex-1 min-w-0 text-xs">
                <span className="font-bold text-white block truncate">{inv.artwork.title}</span>
                <span className="text-[10px] text-neutral-400 block">{inv.artwork.category}</span>
                <span className="text-[11px] text-emerald-400 font-bold block mt-0.5">{inv.requestedSize ? `${inv.requestedSize.nombre}: Q${inv.requestedSize.precio}` : `Desde Q${inv.artwork.basePrice}`}</span>
              </div>
            </div>
          )}
        </div>
      )}
      {sps && sps.length > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-700/70 space-y-2">
          <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider block">🎨 Obras encontradas en catálogo ({sps.length}):</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sps.map((sp) => (
              <div key={sp.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-black border border-neutral-700 hover:border-neutral-500 transition-all shadow-sm">
                <img src={sp.thumbUrl || sp.imageUrl} alt={sp.titulo} className="w-10 h-14 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900 shadow" />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-xs text-white block truncate">{sp.titulo}</span>
                  <span className="text-[10px] text-neutral-400 block truncate">{sp.subtitulo || sp.categoria}</span>
                  <span className="text-[11px] text-emerald-400 font-bold block mt-0.5">Desde Q{sp.precioMinimo}</span>
                </div>
                {addFn && (
                  <button type="button" onClick={() => addFn(sp)} className="px-2.5 py-1.5 bg-white hover:bg-neutral-200 text-black rounded-lg text-[10px] font-black shrink-0 shadow cursor-pointer transition-transform active:scale-95">
                    + Vender
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
