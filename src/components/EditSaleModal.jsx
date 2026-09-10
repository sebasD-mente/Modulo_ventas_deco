import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Banknote,
  CreditCard,
  Smartphone,
  Plus,
  Minus,
  Trash2,
  Loader2,
  FileEdit,
} from 'lucide-react';

export default function EditSaleModal({ sale, onClose, onSaved }) {
  if (!sale) return null;
  const { authFetch } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState(
    sale.payments?.[0]?.method || 'EFECTIVO'
  );
  const [items, setItems] = useState(
    (sale.items || []).map((it) => ({
      id: it.id,
      productId: it.productId || null,
      description: it.description,
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      subtotal: Number(it.subtotal) || 0,
    }))
  );
  const [discount, setDiscount] = useState(Number(sale.discount || 0));
  const [notes, setNotes] = useState(sale.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Modificar cantidad de un ítem (inmutabilidad estricta)
  const handleUpdateQuantity = (idx, delta) => {
    setItems((prevItems) => {
      const current = prevItems[idx];
      if (!current) return prevItems;
      const newQty = Math.max(1, current.quantity + delta);
      const updated = [...prevItems];
      updated[idx] = {
        ...current,
        quantity: newQty,
        subtotal: Number((newQty * current.unitPrice).toFixed(2)),
      };
      return updated;
    });
  };

  // Eliminar un ítem del ticket (inmutabilidad estricta)
  const handleRemoveItem = (idx) => {
    setItems((prevItems) => {
      if (prevItems.length <= 1) {
        alert('La venta debe conservar al menos un póster.');
        return prevItems;
      }
      return prevItems.filter((_, i) => i !== idx);
    });
  };

  // Calcular totales reactivos
  const itemsTotal = items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
  const grandTotal = Math.max(0, itemsTotal - Number(discount || 0));

  // Guardar cambios
  const handleSaveChanges = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      setErrorMsg('Debes incluir al menos un producto.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        items: items.map((it) => ({
          productId: it.productId || null,
          description: it.description,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
        })),
        payments: [
          {
            method: paymentMethod,
            amount: Number(grandTotal.toFixed(2)),
            reference: notes || null,
          },
        ],
        discount: Number(discount || 0),
        notes: notes || null,
      };

      const res = await authFetch(`/api/sales/${sale.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al guardar los cambios.');
      }

      if (onSaved) onSaved(json.data);
      onClose();
    } catch (err) {
      console.error('Error editando venta:', err);
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#141414] border border-neutral-800 rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-white">
        {/* Encabezado */}
        <div className="px-6 py-4 bg-[#181818] border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileEdit className="w-4 h-4 text-white" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Editar venta <span className="font-mono text-white">{sale.saleNumber}</span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                Ajusta método de pago, cantidades o notas de esta transacción
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSaveChanges} className="p-5 overflow-y-auto space-y-4 no-scrollbar text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. SELECCIÓN DE MÉTODO DE PAGO */}
          <div>
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-1.5">
              1. Desplegar método de pago (1 Toque)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('EFECTIVO')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border font-bold text-xs transition-all cursor-pointer ${
                  paymentMethod === 'EFECTIVO'
                    ? 'bg-white text-black border-white shadow-md font-black'
                    : 'bg-black border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>💵 Efectivo</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('TARJETA')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border font-bold text-xs transition-all cursor-pointer ${
                  paymentMethod === 'TARJETA'
                    ? 'bg-white text-black border-white shadow-md font-black'
                    : 'bg-black border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>💳 Tarjeta</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('TRANSFERENCIA')}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border font-bold text-xs transition-all cursor-pointer ${
                  paymentMethod === 'TRANSFERENCIA'
                    ? 'bg-white text-black border-white shadow-md font-black'
                    : 'bg-black border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>📲 Transfer</span>
              </button>
            </div>
          </div>

          {/* 2. PRODUCTOS / PÓSTERS EN LA VENTA */}
          <div>
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-1.5">
              2. Pósters en la venta ({items.length})
            </label>
            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-black border border-neutral-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-white block truncate">{it.description}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Precio unitario: Q {it.unitPrice.toFixed(2)}
                    </span>
                  </div>

                  {/* Stepper de cantidad */}
                  <div className="flex items-center gap-1 bg-[#181818] px-2 py-1 rounded-lg border border-neutral-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(idx, -1)}
                      className="text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-4 text-center font-bold text-white">{it.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(idx, 1)}
                      className="text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right shrink-0 min-w-[65px]">
                    <span className="font-mono font-bold text-emerald-400 block">
                      Q {(it.quantity * it.unitPrice).toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="text-neutral-500 hover:text-red-400 p-1 cursor-pointer shrink-0"
                    title="Eliminar este ítem"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 3. DESCUENTO Y NOTAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-800">
            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Descuento Opcional (Q)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Nota / Referencia
              </label>
              <input
                type="text"
                placeholder="Ej. No. autorización, cliente..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white"
              />
            </div>
          </div>

          {/* TOTAL Y BOTONES */}
          <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-neutral-400 block">Total Recalculado:</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                Q {grandTotal.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 text-xs font-bold hover:text-white hover:border-neutral-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || items.length === 0}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer transition-transform active:scale-95"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar cambios</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
