import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle,
  Loader2,
  Receipt,
  X,
} from 'lucide-react';
import { partitionEventSalesForPos } from '../utils/counterSalesFilter.js';
import EditSaleModal from './EditSaleModal.jsx';
import RecentSaleRow from './sales/RecentSaleRow.jsx';
import BalancePaymentModal from './sales/BalancePaymentModal.jsx';
import WhatsAppQuoteShareModal from './manual-sale/WhatsAppQuoteShareModal.jsx';

export default function RecentSalesList({ eventId, refreshTrigger, onSaleUpdated }) {
  const { authFetch, user, isVendedor, isSuperAdmin } = useAuth();
  const [sales, setSales] = useState([]);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [balancePayingSale, setBalancePayingSale] = useState(null);
  const [sharingSale, setSharingSale] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const toastTimerRef = useRef(null);

  const fetchSales = async () => {
    if (!eventId) return;
    setIsLoading(true);
    try {
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
      const res = await authFetch(`/api/sales/events/${eventId}?date=${todayStr}`);
      const json = await res.json();
      if (json.success) setSales(json.data || []);
    } catch (err) {
      console.error('Error al cargar ventas de hoy:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setShowPendingOnly(false);
  }, [eventId]);

  useEffect(() => {
    fetchSales();
  }, [eventId, refreshTrigger]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleSaleSaved = (updatedSale) => {
    setSales((prev) => prev.map((s) => (s.id === updatedSale.id ? { ...s, ...updatedSale } : s)));
    setSuccessToast(`Venta ${updatedSale.saleNumber} modificada correctamente.`);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3500);
    if (onSaleUpdated) onSaleUpdated();
  };

  const handleBalancePaid = (updatedSale) => {
    const nextBalance = updatedSale.balanceDue !== undefined ? Number(updatedSale.balanceDue) : 0;
    const nextPaymentStatus = updatedSale.paymentStatus || (nextBalance <= 0 ? 'PAGADO_TOTAL' : 'ANTICIPO_PAGADO');

    setSales((prev) =>
      prev.map((s) => {
        if (s.id !== updatedSale.id) return s;
        const mergedItems = Array.isArray(updatedSale.items) && Array.isArray(s.items)
          ? updatedSale.items.map((it, idx) => ({
              ...(s.items.find((prevIt) => prevIt.id === it.id) || s.items[idx] || {}),
              ...it,
            }))
          : (updatedSale.items || s.items);
        return {
          ...s,
          ...updatedSale,
          items: mergedItems,
          balanceDue: nextBalance,
          paymentStatus: nextPaymentStatus,
          ...(nextBalance <= 0
            ? {
                balanceCollectedById: updatedSale.balanceCollectedById || user?.id || null,
                standCollectedAt: updatedSale.standCollectedAt || new Date().toISOString(),
              }
            : {}),
        };
      })
    );
    setBalancePayingSale(null);
    if (nextBalance <= 0) {
      setShowPendingOnly(false);
      setSuccessToast(`Saldo de orden #${updatedSale.saleNumber} liquidado exitosamente.`);
    } else {
      setSuccessToast(`Anticipo de orden #${updatedSale.saleNumber} registrado exitosamente.`);
    }
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3500);
    if (onSaleUpdated) onSaleUpdated();
  };

  const { isStandPos, defaultSales, pendingSales } = partitionEventSalesForPos({
    sales,
    eventId,
    user,
    isVendedor,
    isSuperAdmin,
  });
  const pendingCount = pendingSales.length;
  const displayedSales = showPendingOnly ? pendingSales : defaultSales;

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl space-y-4 text-white max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-sm text-white uppercase tracking-wider">
            Ventas de Hoy ({defaultSales.length})
          </h3>
        </div>

        {/* Pestaña Única Conmutable de Ventas con Saldo Pendiente */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            aria-pressed={showPendingOnly}
            onClick={() => setShowPendingOnly((prev) => !prev)}
            title={showPendingOnly ? 'Volver al listado de ventas de mostrador' : 'Ver ventas con saldo pendiente de entrega en este punto de venta'}
            className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border flex items-center gap-1.5 ${
              showPendingOnly
                ? 'bg-amber-400 text-black border-amber-400 shadow-sm'
                : pendingCount > 0
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-black text-neutral-500 border-neutral-800 hover:text-neutral-300'
            }`}
          >
            <span>⏳ Con Saldo ({pendingCount})</span>
            {showPendingOnly && <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {successToast && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{successToast}</span>
        </div>
      )}

      {isLoading && sales.length === 0 ? (
        <div className="py-8 text-center text-neutral-500 text-xs flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 text-white animate-spin" />
          <span>Cargando ventas recientes...</span>
        </div>
      ) : displayedSales.length === 0 ? (
        <div className="py-8 text-center text-neutral-500 text-xs">
          {showPendingOnly
            ? 'No hay ventas con saldo pendiente de cobro en este punto de venta.'
            : 'Aún no se han registrado ventas hoy en este evento. Realiza una venta arriba para verla aquí.'}
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto no-scrollbar pr-0.5">
          {displayedSales.map((sale) => (
            <RecentSaleRow
              key={sale.id}
              sale={sale}
              standEventId={isStandPos ? eventId : null}
              onEdit={setEditingSale}
              onBalancePayment={setBalancePayingSale}
              onShareWhatsApp={setSharingSale}
            />
          ))}
        </div>
      )}

      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSaved={handleSaleSaved}
        />
      )}

      {balancePayingSale && (
        <BalancePaymentModal
          sale={balancePayingSale}
          onClose={() => setBalancePayingSale(null)}
          onSuccess={handleBalancePaid}
        />
      )}

      {sharingSale && (
        <WhatsAppQuoteShareModal
          isOpen={Boolean(sharingSale)}
          sale={sharingSale}
          onClose={() => setSharingSale(null)}
        />
      )}
    </div>
  );
}
