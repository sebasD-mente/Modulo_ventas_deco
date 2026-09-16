import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  Edit,
  Banknote,
  CreditCard,
  Smartphone,
  CheckCircle,
  Loader2,
  Receipt,
} from 'lucide-react';
import EditSaleModal from './EditSaleModal.jsx';
import RecentSaleRow from './sales/RecentSaleRow.jsx';

export default function RecentSalesList({ eventId, refreshTrigger, onSaleUpdated }) {
  const { authFetch } = useAuth();
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
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

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl space-y-4 text-white max-w-2xl mx-auto">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-sm text-white uppercase tracking-wider">
            Ventas de Hoy ({sales.length})
          </h3>
        </div>
        <span className="text-[11px] text-neutral-400">
          Haz clic en <strong className="text-white">Editar</strong> para corregir
        </span>
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
      ) : sales.length === 0 ? (
        <div className="py-8 text-center text-neutral-500 text-xs">
          Aún no se han registrado ventas hoy en este evento. Realiza una venta arriba para verla aquí.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto no-scrollbar pr-0.5">
          {sales.map((sale) => (
            <RecentSaleRow key={sale.id} sale={sale} onEdit={setEditingSale} />
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
    </div>
  );
}
