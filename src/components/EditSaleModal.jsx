import React, { useState } from 'react';
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

  // Modificar cantidad de un ítem
  const handleUpdateQuantity = (idx, delta) => {
    const updated = [...items];
    const current = updated[idx];
    const newQty = Math.max(1, current.quantity + delta);
    current.quantity = newQty;
    current.subtotal = Number((newQty * current.unitPrice).toFixed(2));
    setItems(updated);
  };

  // Eliminar un ítem del ticket
  const handleRemoveItem = (idx) => {
    if (items.length <= 1) {
      alert('La venta debe conservar al menos un póster.');
      return;
    }
    setItems(items.filter((_, i) => i !== idx));
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

      const res = await fetch(`/api/sales/${sale.id}`, {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="px-5 py-3.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Editar Venta <span className="font-mono text-amber-400">{sale.saleNumber}</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Ajusta el método de pago, cantidades o notas si ocurrió un error en el stand
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSaveChanges} className="p-5 overflow-y-auto space-y-4 no-scrollbar text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. SELECCIÓN DE MÉTODO DE PAGO */}
          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
              1. Método de Pago (1 Toque)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('EFECTIVO')}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  paymentMethod === 'EFECTIVO'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>💵 Efectivo</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('TARJETA')}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  paymentMethod === 'TARJETA'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>💳 Tarjeta</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('TRANSFERENCIA')}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  paymentMethod === 'TRANSFERENCIA'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>📲 Transfer</span>
              </button>
            </div>
          </div>

          {/* 2. PRODUCTOS / PÓSTERS EN LA VENTA */}
          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
              2. Pósters en la Venta ({items.length})
            </label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-200 block truncate">{it.description}</span>
                    <span className="text-[10px] text-slate-500">
                      Precio unitario: Q {it.unitPrice.toFixed(2)}
                    </span>
                  </div>

                  {/* Stepper de cantidad */}
                  <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(idx, -1)}
                      className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-5 text-center font-bold text-slate-200">{it.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(idx, 1)}
                      className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right shrink-0 min-w-[70px]">
                    <span className="font-mono font-bold text-emerald-400 block">
                      Q {(it.quantity * it.unitPrice).toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded cursor-pointer shrink-0"
                    title="Eliminar este ítem"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 3. DESCUENTO Y NOTAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Descuento Opcional (Q)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Nota / No. Referencia
              </label>
              <input
                type="text"
                placeholder="Ej. No. autorización tarjeta, nombre..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* TOTAL Y BOTONES */}
          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-slate-400 block">Total Recalculado:</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                Q {grandTotal.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || items.length === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar Cambios</span>
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
