import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Calendar, ChevronLeft, ChevronRight, Loader2, Search,
  CheckCircle2, Clock, AlertCircle, Truck, MapPin, Phone, User,
  Banknote, CreditCard, Smartphone, Award, Package, Image as ImageIcon, RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useModalBackHandler } from '../../../hooks/useSpaBackNavigation';

const getGuatemalaCurrentMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date()).slice(0, 7);

const shiftMonth = (monthStr, delta) => {
  const [y, m] = String(monthStr || getGuatemalaCurrentMonth()).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const formatSpanishMonth = (monthStr) => {
  const [y, m] = String(monthStr || '').split('-').map(Number);
  if (!y || !m) return monthStr;
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-GT', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatSaleDateTime = (dateInput) => {
  if (!dateInput) return '';
  return new Date(dateInput).toLocaleString('es-GT', {
    timeZone: 'America/Guatemala',
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const DELIVERY_LABELS = {
  ENVIO_NACIONAL: '🚚 Envío Nacional',
  MENSAJERIA: '🛵 Mensajería / Moto',
  RECOGER_EN_STAND: '🏪 Recoger en Stand',
  PUNTO_VENTA: '🏬 Punto de Venta',
};

function getCommissionBadge(sale) {
  const baseProductos = Math.max(0, Number(sale.totalAmount || 0) - Number(sale.shippingCost || 0));
  const estCommission = Number((baseProductos * 0.20).toFixed(2));
  const settlement = sale.commissionSettlement;
  const settlementCode = settlement?.settlementNumber ? ` (${settlement.settlementNumber})` : '';

  if (sale.commissionPaid) {
    return {
      label: `✅ Comisión Pagada${settlementCode}`,
      cls: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
      estCommission,
    };
  }
  if (sale.commissionSettlementId || settlement) {
    return {
      label: `📋 En Corte${settlementCode} • Pendiente Pago`,
      cls: 'bg-blue-500/15 border-blue-500/40 text-blue-300',
      estCommission,
    };
  }
  if (Number(sale.balanceDue || 0) > 0) {
    return {
      label: '⏳ Esperando Cobro Total',
      cls: 'bg-neutral-800 border-neutral-700 text-neutral-400',
      estCommission,
    };
  }
  return {
    label: '🟡 Sin Cargar a Comisión',
    cls: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
    estCommission,
  };
}

export default function OnlineSalesHistoryModal({ event, onClose }) {
  const { authFetch } = useAuth();
  const isOpen = Boolean(event);
  useModalBackHandler(isOpen, onClose);

  const [selectedMonth, setSelectedMonth] = useState(getGuatemalaCurrentMonth);
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const eventId = event?.id || 'evt-ventas-redes-online';

  const fetchMonthSales = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await authFetch(`/api/sales/events/${eventId}?month=${encodeURIComponent(selectedMonth)}&limit=500`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error cargando ventas del mes.');
      setSales(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setErrorMsg(err.message || 'Error consultando historial mensual.');
      setSales([]);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, eventId, isOpen, selectedMonth]);

  useEffect(() => {
    if (isOpen) fetchMonthSales();
  }, [isOpen, fetchMonthSales]);

  const monthSummary = useMemo(() => {
    let totalSold = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let paidCommissions = 0;
    let pendingCommissions = 0;

    sales.forEach((s) => {
      const total = Number(s.totalAmount || 0);
      const balance = Math.max(0, Number(s.balanceDue || 0));
      const collected = Math.max(0, total - balance);
      const baseProd = Math.max(0, total - Number(s.shippingCost || 0));
      const comm = baseProd * 0.20;

      totalSold += total;
      totalCollected += collected;
      totalPending += balance;
      if (s.commissionPaid) paidCommissions += comm;
      else if (balance <= 0) pendingCommissions += comm;
    });

    return {
      count: sales.length,
      totalSold,
      totalCollected,
      totalPending,
      paidCommissions,
      pendingCommissions,
    };
  }, [sales]);

  const filteredSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sales.filter((s) => {
      const balance = Number(s.balanceDue || 0);
      if (statusFilter === 'PAID' && balance > 0) return false;
      if (statusFilter === 'PENDING_BALANCE' && balance <= 0) return false;
      if (statusFilter === 'COMM_PAID' && !s.commissionPaid) return false;
      if (statusFilter === 'COMM_PENDING' && (s.commissionPaid || balance > 0)) return false;

      if (!q) return true;
      const haystack = [
        s.saleNumber,
        s.customer?.fullName,
        s.customer?.phone,
        s.customer?.department,
        s.customer?.municipality,
        s.shippingCourier,
        s.shippingTrackingNumber,
        s.commissionSettlement?.settlementNumber,
        s.pickupEvent?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sales, searchQuery, statusFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#121212] border border-neutral-800 rounded-[28px] w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white">
        {/* Header */}
        <div className="px-5 py-4 bg-[#181818] border-b border-neutral-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2 truncate">
              <Award className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Historial de Ventas en Línea</span>
            </h3>
            <p className="text-[11px] text-neutral-400 truncate">
              {formatSpanishMonth(selectedMonth)} • Pagos, comisiones y logística de entrega
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar historial"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Mes y Búsqueda */}
        <div className="p-4 bg-[#151515] border-b border-neutral-800/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
                aria-label="Mes anterior"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-black border border-neutral-800 hover:border-neutral-600 text-neutral-300 hover:text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 bg-black border border-neutral-700 rounded-xl px-3 min-h-[44px]">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                <input
                  type="month"
                  aria-label="Seleccionar mes de historial"
                  value={selectedMonth}
                  max={getGuatemalaCurrentMonth()}
                  onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
                disabled={selectedMonth >= getGuatemalaCurrentMonth()}
                aria-label="Mes siguiente"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-black border border-neutral-800 hover:border-neutral-600 text-neutral-300 hover:text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={fetchMonthSales}
              disabled={isLoading}
              className="min-h-[44px] px-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por orden, cliente, teléfono, guía o corte..."
                className="w-full min-h-[40px] pl-9 pr-3 rounded-xl bg-black border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { key: 'ALL', label: 'Todas' },
                { key: 'PAID', label: '✅ Pagadas' },
                { key: 'PENDING_BALANCE', label: '⏳ Con Saldo' },
                { key: 'COMM_PAID', label: '💵 Com. Pagada' },
                { key: 'COMM_PENDING', label: '🟡 Com. Pendiente' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap border cursor-pointer transition-colors ${
                    statusFilter === tab.key
                      ? 'bg-white text-black border-white'
                      : 'bg-black text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 no-scrollbar">
          {/* Resumen Mensual */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 rounded-2xl bg-black border border-neutral-800">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Vendido ({monthSummary.count})</span>
              <span className="text-sm sm:text-base font-black font-mono text-white">Q {monthSummary.totalSold.toFixed(2)}</span>
            </div>
            <div className="p-3 rounded-2xl bg-black border border-neutral-800">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Cobrado</span>
              <span className="text-sm sm:text-base font-black font-mono text-emerald-400">Q {monthSummary.totalCollected.toFixed(2)}</span>
            </div>
            <div className="p-3 rounded-2xl bg-black border border-neutral-800">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Saldo Pendiente</span>
              <span className={`text-sm sm:text-base font-black font-mono ${monthSummary.totalPending > 0 ? 'text-amber-400' : 'text-neutral-400'}`}>
                Q {monthSummary.totalPending.toFixed(2)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-black border border-neutral-800">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Comisión (20%)</span>
              <span className="text-xs font-bold font-mono text-emerald-300 block">
                Pag: Q {monthSummary.paidCommissions.toFixed(2)}
              </span>
              <span className="text-[10px] font-mono text-amber-300 block">
                Pend: Q {monthSummary.pendingCommissions.toFixed(2)}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-14 text-center flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              <span className="text-xs text-neutral-400">Cargando historial de {formatSpanishMonth(selectedMonth)}...</span>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 rounded-2xl bg-black border border-neutral-800 text-center space-y-1">
              <Package className="w-7 h-7 text-neutral-600 mx-auto" />
              <div className="text-xs font-bold text-neutral-300">
                No hay ventas registradas en {formatSpanishMonth(selectedMonth)}
              </div>
              <p className="text-[11px] text-neutral-500">
                Usa el selector de mes arriba para consultar meses anteriores o ajusta los filtros.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSales.map((sale) => {
                const balanceDue = Number(sale.balanceDue || 0);
                const isPaid = balanceDue <= 0;
                const commBadge = getCommissionBadge(sale);
                const deliveryLabel = DELIVERY_LABELS[sale.deliveryMethod] || sale.deliveryMethod || 'Entrega';

                return (
                  <div key={sale.id} className="p-4 rounded-2xl bg-black border border-neutral-800 space-y-3">
                    {/* Fila superior: Número, fecha, total */}
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-900 pb-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-amber-400 text-sm">{sale.saleNumber}</span>
                          {sale.customer?.sourceChannel && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                              {sale.customer.sourceChannel}
                            </span>
                          )}
                          <span className="text-[11px] text-neutral-400">{formatSaleDateTime(sale.createdAt)}</span>
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          Operario: <span className="text-neutral-300 font-medium">{sale.seller?.fullName || 'Vendedor Redes'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-black text-base text-emerald-400">
                          Q {Number(sale.totalAmount || 0).toFixed(2)}
                        </div>
                        {Number(sale.discount || 0) > 0 && (
                          <div className="text-[10px] text-amber-400 font-mono">
                            Desc: -Q {Number(sale.discount).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Estado de Pago y Comisión */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          Pagado Total
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-300 text-[11px] font-bold">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          Saldo Pendiente: Q {balanceDue.toFixed(2)} (Abono: Q {Number(sale.depositAmount || 0).toFixed(2)})
                        </span>
                      )}

                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${commBadge.cls}`}>
                        {commBadge.label} • Est: Q {commBadge.estCommission.toFixed(2)}
                      </span>
                    </div>

                    {/* Pagos realizados */}
                    {Array.isArray(sale.payments) && sale.payments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {sale.payments.map((p, idx) => (
                          <span key={p.id || idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300">
                            {p.method === 'EFECTIVO' ? <Banknote className="w-3 h-3 text-emerald-400" /> : p.method === 'TARJETA' ? <CreditCard className="w-3 h-3 text-blue-400" /> : <Smartphone className="w-3 h-3 text-purple-400" />}
                            <span>{p.method}: Q {Number(p.amount || 0).toFixed(2)}</span>
                            {p.reference ? <span className="text-neutral-500">({p.reference})</span> : null}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Datos de Entrega y Cliente */}
                    <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1.5 text-[11px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-white">{deliveryLabel}</span>
                        {Number(sale.shippingCost || 0) > 0 && (
                          <span className="font-mono text-neutral-300">Envío: Q {Number(sale.shippingCost).toFixed(2)}</span>
                        )}
                      </div>

                      {sale.customer && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-300">
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3 h-3 text-neutral-500" />
                            {sale.customer.fullName}
                          </span>
                          {sale.customer.phone && (
                            <span className="inline-flex items-center gap-1 font-mono text-neutral-400">
                              <Phone className="w-3 h-3 text-neutral-500" />
                              {sale.customer.phone}
                            </span>
                          )}
                        </div>
                      )}

                      {sale.deliveryMethod === 'RECOGER_EN_STAND' && sale.pickupEvent ? (
                        <div className="flex items-start gap-1.5 text-amber-300">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>Recoge en Stand: <strong>{sale.pickupEvent.name}</strong>{sale.pickupEvent.location ? ` (${sale.pickupEvent.location})` : ''}</span>
                        </div>
                      ) : sale.customer?.deliveryAddress ? (
                        <div className="flex items-start gap-1.5 text-neutral-400">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-500" />
                          <span>
                            {sale.customer.deliveryAddress}
                            {[sale.customer.municipality, sale.customer.department].filter(Boolean).length > 0
                              ? ` • ${[sale.customer.municipality, sale.customer.department].filter(Boolean).join(', ')}`
                              : ''}
                          </span>
                        </div>
                      ) : null}

                      {(sale.shippingCourier || sale.shippingTrackingNumber) && (
                        <div className="flex items-center gap-2 text-blue-300 font-mono text-[10px]">
                          <Truck className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {sale.shippingCourier || 'Mensajería'}
                            {sale.shippingTrackingNumber ? ` • Guía: ${sale.shippingTrackingNumber}` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Ítems */}
                    <div className="space-y-1.5 pt-1">
                      {(sale.items || []).map((it, idx) => {
                        const img = it.customImageUrl || it.product?.imageUrl || it.imageUrl;
                        return (
                          <div key={it.id || idx} className="flex items-center justify-between gap-2 text-xs text-neutral-300">
                            <div className="flex items-center gap-2 min-w-0">
                              {img ? (
                                <img src={img} alt={it.description} className="w-8 h-8 rounded-lg object-cover bg-neutral-900 border border-neutral-800 shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 shrink-0 flex items-center justify-center text-neutral-600">
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <span className="truncate">{it.quantity}x {it.description}</span>
                              {it.productionStatus && (
                                <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[9px] font-bold text-neutral-400 shrink-0">
                                  {it.productionStatus}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-neutral-400 shrink-0">Q {Number(it.subtotal || 0).toFixed(2)}</span>
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

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#181818] border-t border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs cursor-pointer shadow-md"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
