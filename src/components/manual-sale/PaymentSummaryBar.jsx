import React, { useState } from 'react';
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
  const [cashReceived, setCashReceived] = useState('');

  const methods = [
    { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
    { id: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
    { id: 'TRANSFERENCIA', label: 'Transfer', icon: Smartphone },
    { id: 'MIXTO', label: 'Mixto', icon: Split },
  ];

  const totalNum = Number(grandTotal || 0);
  const receivedNum = Number(cashReceived) || 0;
  const changeDue = receivedNum >= totalNum ? receivedNum - totalNum : null;

  const handleQuickCash = (amount) => {
    setCashReceived(String(amount));
  };

  const handleQuickDiscount = (amount) => {
    if (setDiscount) setDiscount(amount);
  };

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

      {/* 2. Sección de Descuento Ferial (Táctil >= 44px) */}
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
        <div className="flex items-center gap-2 flex-wrap">
          {[0, 5, 10, 15, 20].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => handleQuickDiscount(val)}
              className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                Number(discount) === val
                  ? 'bg-amber-400 text-black font-black'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {val === 0 ? 'Q 0' : `- Q ${val}`}
            </button>
          ))}
          <div className="flex-1 min-w-[100px] flex items-center bg-black border border-neutral-800 rounded-xl px-2.5">
            <span className="text-xs text-neutral-500 font-mono">Q</span>
            <input
              type="number"
              min="0"
              placeholder="Otro"
              value={discount || ''}
              onChange={(e) => setDiscount && setDiscount(Math.max(0, Number(e.target.value) || 0))}
              className="w-full min-h-[44px] bg-transparent text-white font-mono text-xs font-bold px-1.5 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 3. Vuelto Rápido en Efectivo (Solo visible si método es Efectivo) */}
      {paymentMethod === 'EFECTIVO' && totalNum > 0 && (
        <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-neutral-300 flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-emerald-400" />
              Calculadora de Vuelto Rápido
            </span>
            {changeDue !== null && (
              <span className="text-sm font-black font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-800">
                Vuelto: Q {changeDue.toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleQuickCash(totalNum)}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                receivedNum === totalNum
                  ? 'bg-emerald-400 text-black font-black'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white'
              }`}
            >
              Cabal (Q {totalNum.toFixed(0)})
            </button>
            {[50, 100, 150, 200].filter((v) => v >= totalNum).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleQuickCash(val)}
                className={`min-h-[44px] px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  receivedNum === val
                    ? 'bg-emerald-400 text-black font-black'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white'
                }`}
              >
                Paga Q {val}
              </button>
            ))}
            <div className="flex-1 min-w-[110px] flex items-center bg-black border border-neutral-800 rounded-xl px-2.5">
              <span className="text-xs text-neutral-500 font-mono">Q</span>
              <input
                type="number"
                min="0"
                placeholder="Recibido..."
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="w-full min-h-[44px] bg-transparent text-white font-mono text-xs font-bold px-1.5 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Resumen Total y Botón de Registro */}
      <div className="p-5 rounded-2xl bg-black border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs text-neutral-400 font-medium block">Total a Cobrar:</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
            Q {totalNum.toFixed(2)}
          </span>
        </div>

        <button
          type="button"
          onClick={onConfirmSale}
          disabled={disabled || isSubmitting}
          className="w-full sm:w-auto min-h-[48px] px-8 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-40 transition-all cursor-pointer active:scale-95"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Asentando en Postgres...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Registrar Venta (Q {totalNum.toFixed(2)})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
