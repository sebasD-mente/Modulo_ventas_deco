import React from 'react';
import { Banknote, CreditCard, Smartphone, Tag, CheckCircle2, Loader2 } from 'lucide-react';

export default function PaymentSummaryBar({
  paymentMethod, setPaymentMethod, discount, setDiscount,
  notes, setNotes, grandTotal = 0, isSubmitting = false,
  disabled = false, onConfirmSale,
}) {
  const methods = [
    { id: 'EFECTIVO', label: '💵 Efectivo', icon: Banknote },
    { id: 'TARJETA', label: '💳 Tarjeta', icon: CreditCard },
    { id: 'TRANSFERENCIA', label: '📲 Transfer', icon: Smartphone },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
          3. Desplegar Método de Pago (1 Toque)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {methods.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPaymentMethod && setPaymentMethod(id)}
              className={`flex items-center justify-center gap-2 p-3 rounded-2xl border font-bold text-xs transition-all cursor-pointer ${
                paymentMethod === id
                  ? 'bg-amber-400 text-black border-amber-400 shadow-md font-black'
                  : 'bg-black border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-800">
        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            <span>Descuento Opcional (Q)</span>
          </label>
          <input
            type="number"
            min="0"
            placeholder="0.00"
            value={discount || ''}
            onChange={(e) => setDiscount && setDiscount(Number(e.target.value))}
            className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
            Nota / Cliente
          </label>
          <input
            type="text"
            placeholder="Ej. Cliente frecuente..."
            value={notes || ''}
            onChange={(e) => setNotes && setNotes(e.target.value)}
            className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
          />
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-black border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs text-neutral-400 font-medium block">Total a Cobrar:</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-400">
            Q {Number(grandTotal || 0).toFixed(2)}
          </span>
        </div>

        <button
          type="button"
          onClick={onConfirmSale}
          disabled={disabled || isSubmitting}
          className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-40 transition-all cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Asentando en Postgres...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Registrar Venta (Q {Number(grandTotal || 0).toFixed(2)})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
