import React from 'react';
import { Banknote, CreditCard, Smartphone, CheckCircle2, Loader2, DollarSign, Split } from 'lucide-react';

export default function PaymentSummaryBar({
  paymentMethod = 'EFECTIVO',
  setPaymentMethod,
  discount = 0,
  setDiscount,
  subtotal = 0,
  grandTotal = 0,
  hasActiveCombo = false,
  comboSavings = 0,
  comboTrios = 0,
  mediumCount = 0,
  isSubmitting = false,
  disabled = false,
  onConfirmSale,
}) {
  const methods = [
    { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
    { id: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
    { id: 'TRANSFERENCIA', label: 'Transfer', icon: Smartphone },
    { id: 'MIXTO', label: 'Mixto', icon: Split },
  ];

  const totalNum = Number(grandTotal || 0);

  return (
    <div className="space-y-4">
      {/* 1. Selector de Método de Pago (1 Toque >= 44px) */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
          3. Método de Pago (1 Toque)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {methods.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPaymentMethod && setPaymentMethod(id)}
              className={`min-h-[44px] py-2 px-2.5 sm:px-3 flex items-center justify-center gap-1.5 rounded-xl border font-semibold text-xs transition-all cursor-pointer ${
                paymentMethod === id
                  ? 'bg-amber-400 text-black border-amber-400 shadow-sm font-bold'
                  : 'bg-black border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Sección de Descuento Ferial (Input Directo Limpio >= 44px) */}
      <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-neutral-300 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            Descuento Ferial
          </span>
          {Number(discount) > 0 && (
            <span className="text-amber-400 font-bold font-mono">
              - Q {Number(discount).toFixed(2)}
            </span>
          )}
        </div>
        {hasActiveCombo && (
          <div className="p-2 rounded-xl bg-amber-400/10 border border-amber-400/40 text-amber-300 text-xs flex items-center justify-between font-bold animate-fadeIn">
            <span>🎉 Promo 3xQ165 aplicada ({comboTrios} {comboTrios > 1 ? 'combos' : 'combo'} de 3 medianos)</span>
            <span className="font-mono text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-800">
              -Q{comboSavings}
            </span>
          </div>
        )}
        <div className="flex items-center bg-black border border-neutral-800 focus-within:border-amber-400/60 rounded-xl px-3 transition-colors">
          <span className="text-xs text-neutral-500 font-mono font-bold">Q</span>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Monto de descuento (ej. 10)"
            value={discount === 0 ? '' : discount}
            onChange={(e) => {
              const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0);
              if (setDiscount) setDiscount(val);
            }}
            className="w-full min-h-[44px] bg-transparent text-white font-mono text-xs sm:text-sm font-bold px-2 focus:outline-none placeholder-neutral-600"
          />
          {Number(discount) > 0 && (
            <button
              type="button"
              onClick={() => setDiscount && setDiscount(0)}
              className="text-[11px] text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 cursor-pointer shrink-0 transition-colors"
            >
              Borrar
            </button>
          )}
        </div>
      </div>

      {/* 3. Botón de Registro Directo (Grande, Táctil y Sin Redundancia) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onConfirmSale}
          disabled={disabled || isSubmitting}
          className="w-full min-h-[58px] sm:min-h-[64px] px-6 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/25 disabled:opacity-40 transition-all cursor-pointer active:scale-98"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              <span>Asentando Venta en Base de Datos...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-6 h-6 shrink-0" strokeWidth={2.5} />
              <span>Registrar Venta • Q {totalNum.toFixed(2)}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
