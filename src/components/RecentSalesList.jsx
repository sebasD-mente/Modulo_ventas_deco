import React, { useState, useEffect } from 'react';
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
  FileText,
} from 'lucide-react';
import EditSaleModal from './EditSaleModal.jsx';

export default function RecentSalesList({ eventId, refreshTrigger, onSaleUpdated }) {
  const { authFetch } = useAuth();
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  const fetchSales = async () => {
    if (!eventId) return;
    setIsLoading(true);
    try {
      const res = await authFetch(`/api/sales/events/${eventId}`);
      const json = await res.json();
      if (json.success) {
        setSales(json.data || []);
      }
    } catch (err) {
      console.error('Error al cargar ventas recientes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [eventId, refreshTrigger]);

  const handleSaleSaved = (updatedSale) => {
    // Actualizar lista local inmediatamente
    setSales((prev) =>
      prev.map((s) => (s.id === updatedSale.id ? { ...s, ...updatedSale } : s))
    );
    setSuccessToast(`Venta ${updatedSale.saleNumber} modificada correctamente.`);
    setTimeout(() => setSuccessToast(null), 3500);
    if (onSaleUpdated) onSaleUpdated();
  };

  const getPaymentBadge = (method) => {
    switch (method) {
      case 'TARJETA':
        return (
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold text-[10px] flex items-center gap-1">
            <CreditCard className="w-3 h-3" />
            Tarjeta
          </span>
        );
      case 'TRANSFERENCIA':
        return (
          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold text-[10px] flex items-center gap-1">
            <Smartphone className="w-3 h-3" />
            Transferencia
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] flex items-center gap-1">
            <Banknote className="w-3 h-3" />
            Efectivo
          </span>
        );
    }
  };

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl space-y-4 text-white max-w-2xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-white" />
          <h3 className="font-bold text-sm text-white uppercase tracking-wider">
            Ventas Recientes del Evento ({sales.length})
          </h3>
        </div>
        <span className="text-[11px] text-neutral-400">
          Haz clic en <strong className="text-white">Editar</strong> para corregir
        </span>
      </div>

      {/* Toast de Éxito */}
      {successToast && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{successToast}</span>
        </div>
      )}

      {/* Listado */}
      {isLoading && sales.length === 0 ? (
        <div className="py-8 text-center text-neutral-500 text-xs flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 text-white animate-spin" />
          <span>Cargando ventas recientes...</span>
        </div>
      ) : sales.length === 0 ? (
        <div className="py-8 text-center text-neutral-500 text-xs">
          Aún no se han registrado ventas en este evento. Realiza una venta arriba para verla aquí.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto no-scrollbar pr-0.5">
          {sales.map((sale) => (
            <div
              key={sale.id}
              className="p-3.5 rounded-2xl bg-black border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              {/* Información principal de la venta */}
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-black text-amber-400 text-xs">
                    {sale.saleNumber}
                  </span>
                  <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {new Date(sale.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {getPaymentBadge(sale.payments?.[0]?.method)}
                  {sale.notes && (
                    <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded italic truncate max-w-[200px]">
                      Nota: {sale.notes}
                    </span>
                  )}
                </div>

                {/* Resumen de ítems */}
                <div className="text-[11px] text-slate-300 space-y-0.5">
                  {(sale.items || []).map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-300">
                      <span className="truncate pr-2">
                        • {it.quantity}x {it.description}
                      </span>
                      <span className="font-mono text-slate-400 shrink-0">
                        Q {Number(it.subtotal).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total y Botón de Editar */}
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 shrink-0">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-slate-500 block sm:inline mr-1">Total:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    Q {Number(sale.totalAmount).toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingSale(sale)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Editar venta en caso de error"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Edición Rápida */}
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
