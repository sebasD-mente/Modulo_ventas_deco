import React, { useEffect } from 'react';
import {
  Globe, RefreshCw, Search, X, Download, ShoppingBag,
  User, Phone, MapPin, ExternalLink, Clock, Loader2,
} from 'lucide-react';
import { useModalBackHandler } from '../../hooks/useSpaBackNavigation';
import { formatWebOrderSourceLabel, formatWebMaterialLabel } from './hooks/useWebOrderImport';

function formatGuatemalaStamp(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-GT', {
    timeZone: 'America/Guatemala',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export default function WebOrdersImportModal({
  isOpen,
  onClose,
  orders = [],
  pendingCount = 0,
  searchQuery = '',
  setSearchQuery,
  isLoading = false,
  isSyncing = false,
  feedback = null,
  onSync,
  onImportOrder,
}) {
  useModalBackHandler(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="web-orders-import-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] bg-[#121212] border border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Pedidos Pendientes en Web ({pendingCount})</span>
            </h3>
            <p className="text-[11px] text-neutral-400">
              Elige un pedido de decovintage.online y pulsa Cargar al Formulario
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="sync-web-orders-modal-btn"
              onClick={onSync}
              disabled={isSyncing}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 text-center transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>

            <button
              type="button"
              data-modal-close="true"
              aria-label="Cerrar ventana de pedidos web"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-neutral-800 space-y-2.5 shrink-0 bg-black/40">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              data-testid="web-orders-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery?.(e.target.value)}
              placeholder="Buscar por código #CP-XXXX, cliente o WhatsApp..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 bg-[#161616] border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {feedback && (
            <div className={`p-2.5 rounded-xl text-xs font-semibold ${
              feedback.isError
                ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            }`}>
              {feedback.text}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-neutral-400 text-xs gap-2">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              <span>Consultando bandeja de pedidos web...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 px-4 rounded-2xl border border-dashed border-neutral-800 text-center space-y-2">
              <Globe className="w-7 h-7 mx-auto text-neutral-600" />
              <p className="text-xs font-bold text-neutral-300">No hay pedidos web pendientes en este momento</p>
              <p className="text-[11px] text-neutral-500">
                Pulsa Actualizar para consultar nuevos pedidos en decovintage.online.
              </p>
            </div>
          ) : (
            orders.map((order) => {
              const items = Array.isArray(order.items) ? order.items : [];
              const timeStr = formatGuatemalaStamp(order.webCreatedAt || order.createdAt);
              return (
                <div
                  key={order.id}
                  data-testid="web-order-import-card"
                  className="p-3.5 sm:p-4 rounded-2xl bg-black border border-neutral-800 hover:border-neutral-600 space-y-3 text-xs transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white font-mono text-sm">#{order.orderNumber}</span>
                      <span className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-700 text-neutral-200 font-bold text-[10px] uppercase tracking-wider">
                        {formatWebOrderSourceLabel(order.orderSource)}
                      </span>
                    </div>
                    {timeStr && (
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        <span>{timeStr}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-300">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{order.customerName || 'Cliente Web'}</span>
                    </span>
                    {order.customerPhone && (
                      <span className="font-mono text-neutral-300 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-neutral-500 shrink-0" />
                        <span>{order.customerPhone}</span>
                      </span>
                    )}
                    {(order.customerAddress || order.customerDepartment) && (
                      <span className="text-neutral-400 flex items-center gap-1 truncate max-w-full">
                        <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
                        <span className="truncate">
                          {[order.customerAddress, order.customerDepartment].filter(Boolean).join(' • ')}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    {items.map((it, idx) => {
                      const artUrl = it.imageUrl || it.customImageUrl || it.thumbUrl;
                      const dimBadge = it.customDimensions || it.sizeLabel || 'Estándar';
                      return (
                        <div key={`${order.id}-${idx}`} className="p-2.5 rounded-xl bg-[#141414] border border-neutral-800/90 flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {artUrl ? (
                              <a
                                href={artUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Ver imagen HD original"
                                className="relative w-11 h-11 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-900 shrink-0 group"
                              >
                                <img src={it.thumbUrl || artUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                                <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-cyan-300 transition-opacity">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </span>
                              </a>
                            ) : (
                              <div className="w-11 h-11 rounded-lg border border-neutral-800 bg-neutral-900 flex items-center justify-center shrink-0 text-neutral-600">
                                <ShoppingBag className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0 space-y-0.5">
                              <span className="font-bold text-white block truncate">{it.title || it.description}</span>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-400">
                                <span className="px-1.5 py-0.5 rounded bg-black border border-neutral-800 text-neutral-200 font-semibold">
                                  {dimBadge}
                                </span>
                                <span>{formatWebMaterialLabel(it.material)}</span>
                                <span className="font-bold text-white">x{it.quantity || 1}</span>
                              </div>
                            </div>
                          </div>
                          <span className="font-bold text-neutral-200 whitespace-nowrap shrink-0">
                            Q {Number(it.subtotal || 0).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {order.customerNotes && (
                    <p className="text-[11px] text-neutral-300 italic bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5">
                      Nota cliente: {order.customerNotes}
                    </p>
                  )}

                  <div className="pt-2 border-t border-neutral-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-neutral-400 block font-semibold">Total cotizado en Web</span>
                      <span className="text-base font-black text-emerald-400 whitespace-nowrap">
                        Q {Number(order.quotedTotal || 0).toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      data-testid={`import-web-order-btn-${order.orderNumber}`}
                      onClick={() => onImportOrder?.(order)}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-2 text-center transition-colors cursor-pointer shadow-md shadow-emerald-500/20"
                    >
                      <Download className="w-4 h-4 shrink-0" />
                      <span>Cargar al Formulario</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
