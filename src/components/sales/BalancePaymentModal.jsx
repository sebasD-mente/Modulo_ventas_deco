import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Banknote, CreditCard, Smartphone, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

const PAYMENT_METHODS = [
  { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
  { id: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
  { id: 'TRANSFERENCIA', label: 'Transferencia', icon: Smartphone },
];

export default function BalancePaymentModal({ sale, onClose, onSuccess }) {
  const { authFetch } = useAuth();
  const [method, setMethod] = useState('EFECTIVO');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!sale) return null;

  const totalAmount = Number(sale.totalAmount || 0).toFixed(2);
  const depositAmount = Number(sale.depositAmount || 0).toFixed(2);
  const balanceDue = Number(sale.balanceDue || 0);
  const customerName = sale.customer?.fullName || sale.customerName || 'Cliente';
  const customerPhone = sale.customer?.phone || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (balanceDue <= 0) {
      setErrorMsg('Esta venta no tiene saldo pendiente por cobrar.');
      return;
    }

    if ((method === 'TRANSFERENCIA' || method === 'TARJETA') && !reference.trim()) {
      setErrorMsg('Para transferencias o pagos con tarjeta es requerido ingresar el número de referencia o boleta.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await authFetch(`/api/sales/${sale.id}/balance-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payments: [
            {
              method,
              amount: balanceDue,
              reference: reference.trim() || null,
            },
          ],
          notes: notes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al registrar el cobro de saldo.');
      }

      try { confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } }); } catch (_) {}
      const updated = json.data?.sale || json.data || { ...sale, balanceDue: 0, paymentStatus: 'PAGADO_TOTAL' };
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err) {
      console.error('Error cobrando saldo:', err);
      setErrorMsg(err.message || 'Error en el servidor al registrar el pago de saldo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-neutral-800 rounded-[32px] p-6 max-w-md w-full shadow-2xl text-white space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Cobrar Saldo Pendiente
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ficha Resumen de la Orden */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2 text-xs">
          <div className="flex items-center justify-between font-mono">
            <span className="text-neutral-400">Orden:</span>
            <span className="text-amber-400 font-bold">{sale.saleNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Cliente:</span>
            <span className="text-white font-semibold truncate max-w-[200px]">
              {customerName} {customerPhone ? `(${customerPhone})` : ''}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 text-neutral-400">
            <span>Total Orden:</span>
            <span className="font-mono text-neutral-300">Q {totalAmount}</span>
          </div>
          <div className="flex items-center justify-between text-neutral-400">
            <span>Anticipo Previo:</span>
            <span className="font-mono text-neutral-300">- Q {depositAmount}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-sm font-bold">
            <span className="text-white">Saldo a Cobrar Hoy:</span>
            <span className="font-mono text-emerald-400 text-base">Q {balanceDue.toFixed(2)}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-neutral-400 font-semibold mb-1.5">Método de Pago del Saldo</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                const isSel = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMethod(m.id); setErrorMsg(null); }}
                    className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                      isSel
                        ? 'bg-emerald-500 text-black border-emerald-500 shadow-md'
                        : 'bg-black text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 font-semibold mb-1">
              Referencia / No. Boleta {(method === 'TRANSFERENCIA' || method === 'TARJETA') && '*'}
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => { setReference(e.target.value); setErrorMsg(null); }}
              placeholder={method === 'EFECTIVO' ? 'Opcional para efectivo' : 'Ej. TRANSF-12345 o Autorización'}
              className="w-full min-h-[44px] px-3.5 py-2.5 bg-black border border-neutral-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Notas de Entrega (Opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Entregado en stand ferial o courier recibido"
              className="w-full min-h-[44px] px-3.5 py-2 bg-black border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 rounded-xl text-neutral-400 hover:text-white font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || balanceDue <= 0}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cobrando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cobrar Saldo (Q {balanceDue.toFixed(2)})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
