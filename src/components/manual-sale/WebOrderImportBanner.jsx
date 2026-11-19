import React from 'react';
import { Globe, Link2, Unlink } from 'lucide-react';
import { formatWebOrderSourceLabel } from './hooks/useWebOrderImport';

export default function WebOrderImportBanner({
  pendingCount = 0,
  linkedWebOrder = null,
  onOpenModal,
  onUnlink,
}) {
  return (
    <div
      data-testid="web-order-import-banner"
      className="p-3.5 rounded-2xl bg-black border border-neutral-800 space-y-2.5 text-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Pedidos de Tienda Web</span>
            </span>
            {pendingCount > 0 && (
              <span
                data-testid="web-orders-pending-badge"
                className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-[10px]"
              >
                {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-400 leading-snug">
            Selecciona un pedido de decovintage.online para cargar cliente, artes HD, medidas y precios.
          </p>
        </div>

        <button
          type="button"
          data-testid="open-web-orders-modal-btn"
          onClick={onOpenModal}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs flex items-center justify-center gap-2 text-center transition-colors cursor-pointer shrink-0 shadow-sm"
        >
          <Globe className="w-4 h-4 shrink-0" />
          <span>Importar Pedido Web</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-black text-white text-[10px] font-black leading-none">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {linkedWebOrder && (
        <div
          data-testid="active-web-order-chip"
          className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Link2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-black text-emerald-300 font-mono">
              #{linkedWebOrder.orderNumber} cargado
            </span>
            <span className="text-neutral-300 truncate">
              • {linkedWebOrder.customerName || 'Cliente Web'} ({formatWebOrderSourceLabel(linkedWebOrder.orderSource)})
            </span>
          </div>

          <button
            type="button"
            data-testid="unlink-web-order-btn"
            onClick={onUnlink}
            className="min-h-[44px] px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 text-center transition-colors cursor-pointer shrink-0"
          >
            <Unlink className="w-3.5 h-3.5 shrink-0" />
            <span>Desvincular</span>
          </button>
        </div>
      )}
    </div>
  );
}
