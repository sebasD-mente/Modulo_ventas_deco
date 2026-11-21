import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe, RefreshCw, Search, ArrowRight, Trash2, RotateCcw,
  CheckCircle2, ShoppingBag, User, Phone, MapPin, ExternalLink, Clock, Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatWebOrderSourceLabel, formatWebMaterialLabel } from './manual-sale/hooks/useWebOrderImport';

const STATUS_TABS = [
  { id: 'PENDIENTE', label: 'Pendientes', countKey: 'pending' },
  { id: 'IMPORTADO', label: 'Importados', countKey: 'imported' },
  { id: 'DESCARTADO', label: 'Descartados', countKey: 'discarded' },
];

function formatInboxDate(val) {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-GT', {
    timeZone: 'America/Guatemala', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(d);
}

export default function WebOrdersInboxView({ onImportToSale, onCountsChanged }) {
  const { authFetch } = useAuth();
  const [statusFilter, setStatusFilter] = useState('PENDIENTE');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, imported: 0, discarded: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const onCountsChangedRef = useRef(onCountsChanged);
  onCountsChangedRef.current = onCountsChanged;

  const loadOrders = useCallback(async (targetStatus = statusFilter, query = searchQuery, mutated = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ status: targetStatus, limit: '100' });
      if (query.trim()) params.set('search', query.trim());
      const res = await authFetch(`/api/sales/web-orders?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setOrders(Array.isArray(json.data) ? json.data : []);
        if (json.counts) { setCounts(json.counts); onCountsChangedRef.current?.(json.counts, { mutated }); }
      }
    } catch (err) {
      console.error('[WebOrdersInboxView] Error consultando bandeja web:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, statusFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => { loadOrders(statusFilter, searchQuery, false); }, 180);
    return () => clearTimeout(timer);
  }, [statusFilter, searchQuery, loadOrders]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await authFetch('/api/sales/web-orders/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'PENDIENTE', limit: 100 }),
      });
      const json = await res.json().catch(() => ({}));
      setFeedback({
        text: json.message || (res.ok && json.synced ? 'Bandeja sincronizada con decovintage.online.' : 'No fue posible conectar con la tienda web.'),
        isError: !res.ok || json.synced === false,
      });
      await loadOrders(statusFilter, searchQuery, true);
    } catch {
      setFeedback({ text: 'Error de red sincronizando pedidos web.', isError: true });
    } finally {
      setIsSyncing(false);
    }
  };

  const mutateOrderStatus = async (order, action) => {
    const isDelete = action === 'delete';
    const isDiscard = action === 'discard';
    setActingId(order.id);
    setFeedback(null);
    try {
      const url = isDelete ? `/api/sales/web-orders/${order.id}` : `/api/sales/web-orders/${order.id}/${action}`;
      const res = await authFetch(url, {
        method: isDelete ? 'DELETE' : 'PATCH',
        headers: isDiscard ? { 'Content-Type': 'application/json' } : undefined,
        body: isDiscard ? JSON.stringify({ reason: 'Descartado desde Bandeja Web' }) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo actualizar el pedido web.');
      const okMsg = isDelete
        ? `Pedido #${order.orderNumber} eliminado definitivamente.`
        : isDiscard ? `Pedido #${order.orderNumber} movido a descartados.` : `Pedido #${order.orderNumber} restaurado a pendientes.`;
      setFeedback({ text: okMsg, isError: false });
      await loadOrders(statusFilter, searchQuery, true);
    } catch (err) {
      setFeedback({ text: err.message, isError: true });
    } finally {
      setActingId(null);
    }
  };

  return (
    <div data-testid="web-orders-inbox-view" className="max-w-3xl mx-auto space-y-5 text-white">
      <div className="bg-[#121212] p-5 sm:p-6 rounded-3xl border border-neutral-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Bandeja de Pedidos Web</span>
            </h2>
            <p className="text-xs text-neutral-400">Pedidos recibidos desde decovintage.online listos para revisar e importar a venta</p>
          </div>
          <button
            type="button" data-testid="inbox-sync-web-orders-btn" onClick={handleSync} disabled={isSyncing}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs flex items-center justify-center gap-2 text-center transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 p-1 bg-black rounded-2xl border border-neutral-800">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.id;
            const badgeVal = counts[tab.countKey] ?? 0;
            return (
              <button
                key={tab.id} type="button" data-testid={`inbox-tab-${tab.id}`} onClick={() => setStatusFilter(tab.id)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-center transition-colors cursor-pointer ${
                  active ? 'bg-white text-black shadow-sm font-black' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${active ? 'bg-black text-white' : 'bg-neutral-900 text-neutral-300'}`}>{badgeVal}</span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código #CP-XXXX, nombre de cliente o WhatsApp..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2.5 bg-black border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {feedback && (
          <div className={`p-3 rounded-xl text-xs font-semibold ${feedback.isError ? 'bg-red-500/10 border border-red-500/30 text-red-300' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'}`}>
            {feedback.text}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-neutral-400 text-xs gap-2">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          <span>Cargando pedidos web...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-10 rounded-3xl bg-[#121212] border border-neutral-800 text-center space-y-2">
          <Globe className="w-8 h-8 mx-auto text-neutral-600" />
          <p className="text-sm font-bold text-neutral-300">Sin pedidos en esta bandeja</p>
          <p className="text-xs text-neutral-500">Usa el botón Actualizar para sincronizar desde la página web.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const stamp = formatInboxDate(order.webCreatedAt || order.createdAt);
            return (
              <div key={order.id} data-testid="inbox-web-order-card" className="p-4 sm:p-5 rounded-3xl bg-[#121212] border border-neutral-800 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-white font-mono text-sm">#{order.orderNumber}</span>
                    <span className="px-2 py-0.5 rounded-md bg-black border border-neutral-700 text-neutral-200 font-bold text-[10px] uppercase">{formatWebOrderSourceLabel(order.orderSource)}</span>
                  </div>
                  {stamp && <span className="text-[11px] text-neutral-400 flex items-center gap-1"><Clock className="w-3 h-3 text-neutral-500" /><span>{stamp}</span></span>}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-300">
                  <span className="font-bold text-white flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-emerald-400" />{order.customerName || 'Cliente Web'}</span>
                  {order.customerPhone && <span className="font-mono flex items-center gap-1"><Phone className="w-3 h-3 text-neutral-500" />{order.customerPhone}</span>}
                  {(order.customerAddress || order.customerDepartment) && (
                    <span className="text-neutral-400 flex items-center gap-1"><MapPin className="w-3 h-3 text-neutral-500" />{[order.customerAddress, order.customerDepartment].filter(Boolean).join(' • ')}</span>
                  )}
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => {
                    const artUrl = it.imageUrl || it.customImageUrl || it.thumbUrl;
                    return (
                      <div key={`${order.id}-${idx}`} className="p-2.5 rounded-2xl bg-black border border-neutral-800 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {artUrl ? (
                            <a href={artUrl} target="_blank" rel="noopener noreferrer" className="relative w-12 h-12 rounded-xl overflow-hidden border border-neutral-700 bg-neutral-900 shrink-0 group">
                              <img src={it.thumbUrl || artUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                              <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-cyan-300"><ExternalLink className="w-3.5 h-3.5" /></span>
                            </a>
                          ) : (
                            <div className="w-12 h-12 rounded-xl border border-neutral-800 bg-neutral-900 flex items-center justify-center shrink-0 text-neutral-600"><ShoppingBag className="w-4 h-4" /></div>
                          )}
                          <div className="min-w-0 space-y-0.5">
                            <span className="font-bold text-white block truncate">{it.title || it.description}</span>
                            <span className="text-[11px] text-neutral-400 block truncate">{(it.customDimensions || it.sizeLabel || 'Estándar')} • {formatWebMaterialLabel(it.material)} • x{it.quantity || 1}</span>
                          </div>
                        </div>
                        <span className="font-bold text-neutral-200 whitespace-nowrap shrink-0">Q {Number(it.subtotal || 0).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                {order.customerNotes && (
                  <p className="text-[11px] text-neutral-300 italic bg-black border border-neutral-800 rounded-xl px-3 py-1.5">Nota cliente: {order.customerNotes}</p>
                )}

                <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-400 block font-semibold">Total cotizado</span>
                    <span className="text-base font-black text-emerald-400 whitespace-nowrap">Q {Number(order.quotedTotal || 0).toFixed(2)}</span>
                  </div>

                  {order.status === 'PENDIENTE' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button" data-testid={`inbox-discard-btn-${order.orderNumber}`} disabled={actingId === order.id} onClick={() => mutateOrderStatus(order, 'discard')}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-black hover:bg-red-950/40 border border-neutral-800 text-neutral-300 hover:text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 text-center transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" /><span>Descartar</span>
                      </button>
                      <button
                        type="button" data-testid={`inbox-import-btn-${order.orderNumber}`} onClick={() => onImportToSale?.(order)}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-1.5 text-center transition-colors cursor-pointer shadow-md shadow-emerald-500/20"
                      >
                        <span>Importar a Venta</span><ArrowRight className="w-4 h-4 shrink-0" />
                      </button>
                    </div>
                  )}

                  {order.status === 'DESCARTADO' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button" data-testid={`inbox-delete-btn-${order.orderNumber}`} disabled={actingId === order.id} onClick={() => mutateOrderStatus(order, 'delete')}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-black hover:bg-red-950/40 border border-neutral-800 text-neutral-300 hover:text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 text-center transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" /><span>Eliminar</span>
                      </button>
                      <button
                        type="button" data-testid={`inbox-restore-btn-${order.orderNumber}`} disabled={actingId === order.id} onClick={() => mutateOrderStatus(order, 'restore')}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs flex items-center justify-center gap-1.5 text-center transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4 shrink-0" /><span>Restaurar a Pendientes</span>
                      </button>
                    </div>
                  )}

                  {order.status === 'IMPORTADO' && (
                    <span className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-bold text-xs inline-flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Importado ({order.importedSaleNumber ? `#${order.importedSaleNumber}` : 'Venta registrada'})</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
