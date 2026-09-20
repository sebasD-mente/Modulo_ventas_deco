import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle,
  Loader2,
  Receipt,
  Filter,
} from 'lucide-react';
import EditSaleModal from './EditSaleModal.jsx';
import RecentSaleRow from './sales/RecentSaleRow.jsx';
import BalancePaymentModal from './sales/BalancePaymentModal.jsx';
import WhatsAppQuoteShareModal from './manual-sale/WhatsAppQuoteShareModal.jsx';

export default function RecentSalesList({ eventId, refreshTrigger, onSaleUpdated }) {
  const { authFetch } = useAuth();
  const [sales, setSales] = useState([]);
  const [filterMode, setFilterMode] = useState('TODAS');
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
    setSales((prev) =>
      prev.map((s) => (s.id === updatedSale.id ? { ...s, ...updatedSale, balanceDue: 0, paymentStatus: 'PAGADO_TOTAL' } : s))
    );
    setBalancePayingSale(null);
    setSuccessToast(`Saldo de orden #${updatedSale.saleNumber} liquidado exitosamente.`);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSuccessToast(null), 3500);
    if (onSaleUpdated) onSaleUpdated();
  };

  const pendingCount = sales.filter((s) => Number(s.balanceDue || 0) > 0).length;
  const displayedSales = filterMode === 'CON_SALDO'
    ? sales.filter((s) => Number(s.balanceDue || 0) > 0)
    : sales;

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl space-y-4 text-white max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-sm text-white uppercase tracking-wider">
            Ventas de Hoy ({sales.length})
          </h3>
        </div>

        {/* Filtro Rápido de Saldo */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterMode('TODAS')}
            className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterMode === 'TODAS'
                ? 'bg-white text-black'
                : 'bg-black text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Todas ({sales.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('CON_SALDO')}
            className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
              filterMode === 'CON_SALDO'
                ? 'bg-amber-400 text-black border-amber-400'
                : pendingCount > 0
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-black text-neutral-500 border-neutral-800'
            }`}
          >
            ⏳ Con Saldo ({pendingCount})
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
          {filterMode === 'CON_SALDO'
            ? 'No hay ventas con saldo pendiente de cobro.'
            : 'Aún no se han registrado ventas hoy en este evento. Realiza una venta arriba para verla aquí.'}
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto no-scrollbar pr-0.5">
          {displayedSales.map((sale) => (
            <RecentSaleRow
              key={sale.id}
              sale={sale}
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
