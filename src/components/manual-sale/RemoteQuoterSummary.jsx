import React from 'react';
import { Calculator, Smartphone, CreditCard, Banknote, AlertTriangle, CheckCircle2, Loader2, DollarSign } from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'TRANSFERENCIA', label: 'Transferencia', icon: Smartphone },
  { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
  { id: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
];

export default function RemoteQuoterSummary({
  productsSubtotal = 0,
  productsAmount = 0,
  discount = 0,
  effectiveShippingCost = 0,
  totalAmount = 0,
  minDeposit = 0,
  depositInput = '',
  setDepositInput,
  numericDeposit = 0,
  balanceDue = 0,
  isDepositValid = false,
  depositPaymentMethod,
  setDepositPaymentMethod,
  depositReference,
  setDepositReference,
  remoteSaleNotes,
  setRemoteSaleNotes,
  isSubmitting,
  submitError,
  onConfirmRemoteSale,
}) {
  const isInsufficient = totalAmount > 0 && numericDeposit < minDeposit;
  const isPaidTotal = totalAmount > 0 && numericDeposit >= totalAmount;

  return (
    <div className="space-y-4 p-5 rounded-2xl bg-black border border-neutral-800 text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <label className="font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
          <Calculator className="w-4 h-4 text-amber-400" />
          <span>3. Cotizador 50/50 & Registro de Anticipo</span>
        </label>
        <span className="font-mono text-neutral-400 text-[11px]">
          Flete: Q {effectiveShippingCost.toFixed(2)}
        </span>
      </div>

      {/* Desglose Contable de la Orden */}
      <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
        <div className="flex items-center justify-between text-neutral-400">
          <span>Subtotal Productos:</span>
          <span className="font-mono text-white">Q {productsSubtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex items-center justify-between text-amber-400">
            <span>Descuento aplicado:</span>
            <span className="font-mono">- Q {Number(discount).toFixed(2)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-neutral-400">
          <span>Envío / Flete:</span>
          <span className="font-mono text-white">Q {effectiveShippingCost.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-neutral-800 text-white">
          <span>Total de la Orden:</span>
          <span className="font-mono text-emerald-400 text-base">Q {totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Control de Anticipo 50/50 */}
      <div className="p-3.5 rounded-xl bg-[#141414] border border-amber-500/30 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="font-semibold text-neutral-200 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            <span>Monto de Anticipo a Registrar</span>
          </span>
          <span className="text-amber-400 font-mono font-bold text-[11px]">
            Mínimo 50%: Q {minDeposit.toFixed(2)}
          </span>
        </div>

        {/* Botones de 1 Toque */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDepositInput(minDeposit.toString())}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
              numericDeposit === minDeposit && !isPaidTotal
                ? 'bg-amber-400 text-black border-amber-400 shadow-sm'
                : 'bg-black text-amber-300 border-amber-500/30 hover:bg-neutral-900'
            }`}
          >
            ⚡ 50% Anticipo (Q {minDeposit.toFixed(2)})
          </button>
          <button
            type="button"
            onClick={() => setDepositInput(totalAmount.toString())}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
              isPaidTotal
                ? 'bg-emerald-500 text-black border-emerald-500 shadow-sm'
                : 'bg-black text-emerald-400 border-emerald-500/30 hover:bg-neutral-900'
            }`}
          >
            💯 100% Total (Q {totalAmount.toFixed(2)})
          </button>
        </div>

        {/* Input Numérico de Anticipo Personalizado */}
        <div>
          <label className="block text-[11px] text-neutral-400 mb-1">Monto ingresado por el cliente (Q):</label>
          <input
            type="number"
            min="0"
            step="any"
            value={depositInput}
            onChange={(e) => setDepositInput(e.target.value)}
            placeholder={`Mínimo Q ${minDeposit.toFixed(2)}`}
            className="w-full min-h-[44px] px-3.5 py-2.5 bg-black border border-neutral-800 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Freno Preventivo Visual */}
        {isInsufficient && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Anticipo insuficiente</span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Para iniciar producción en taller se requiere un abono mínimo de <strong>Q {minDeposit.toFixed(2)} (50%)</strong>. Saldo pendiente sería: Q {balanceDue.toFixed(2)}.
            </p>
          </div>
        )}

        {isDepositValid && !isPaidTotal && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Anticipo 50% válido</span>
            </span>
            <span className="font-bold font-mono">Saldo pendiente: Q {balanceDue.toFixed(2)}</span>
          </div>
        )}

        {isPaidTotal && (
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Pago completo (100%)</span>
            </span>
            <span className="font-bold font-mono">Saldo: Q 0.00</span>
          </div>
        )}
      </div>

      {/* Método de Pago del Anticipo */}
      <div className="space-y-2.5">
        <label className="block text-[11px] font-semibold text-neutral-400">Método de Pago del Anticipo</label>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => {
            const Icon = m.icon;
            const isSel = depositPaymentMethod === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setDepositPaymentMethod(m.id)}
                className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                  isSel
                    ? 'bg-white text-black border-white'
                    : 'bg-black text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            type="text"
            value={depositReference}
            onChange={(e) => setDepositReference(e.target.value)}
            placeholder="No. de Boleta / Transferencia..."
            className="w-full min-h-[44px] px-3.5 py-2 bg-black border border-neutral-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            value={remoteSaleNotes}
            onChange={(e) => setRemoteSaleNotes(e.target.value)}
            placeholder="Notas del pedido (opcional)..."
            className="w-full min-h-[44px] px-3.5 py-2 bg-black border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {submitError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold">
          ⚠️ {submitError}
        </div>
      )}

      {/* Botón Primario de Confirmación */}
      <button
        type="button"
        disabled={!isDepositValid || isSubmitting}
        onClick={onConfirmRemoteSale}
        className={`w-full min-h-[48px] px-6 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl active:scale-95 ${
          !isDepositValid || isSubmitting
            ? 'opacity-40 pointer-events-none bg-neutral-800 text-neutral-500 border border-neutral-700'
            : 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/20'
        }`}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Registrando pedido y enviando a taller...</span>
          </>
        ) : (
          <span>
            {isPaidTotal
              ? `Registrar Pedido 100% Pagado (Q ${numericDeposit.toFixed(2)})`
              : `Registrar Pedido 50/50 (Abono Q ${numericDeposit.toFixed(2)})`}
          </span>
        )}
      </button>
    </div>
  );
}
