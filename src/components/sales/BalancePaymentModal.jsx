import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Banknote, CreditCard, Smartphone, X, Loader2, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useModalBackHandler } from '../../hooks/useSpaBackNavigation';

const PAYMENT_METHODS = [
  { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
  { id: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
  { id: 'TRANSFERENCIA', label: 'Transferencia', icon: Smartphone },
];

export default function BalancePaymentModal({ sale, onClose, onSuccess }) {
  const { authFetch } = useAuth();
  const isPendingPayment = sale?.paymentStatus === 'PENDIENTE_PAGO';
  const minDeposit = Number((Number(sale?.totalAmount || 0) * 0.50).toFixed(2));

  const [method, setMethod] = useState(isPendingPayment ? 'TRANSFERENCIA' : 'EFECTIVO');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitMethod2, setSplitMethod2] = useState('TRANSFERENCIA');
  const [splitAmount1, setSplitAmount1] = useState('');
  const [reference2, setReference2] = useState('');
  const [customAmount, setCustomAmount] = useState(isPendingPayment ? minDeposit.toString() : Number(sale?.balanceDue || 0).toString());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [idempotencyKey] = useState(() =>
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `bal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );

  useModalBackHandler(Boolean(sale), onClose);
  if (!sale) return null;

  const totalAmount = Number(sale.totalAmount || 0).toFixed(2);
  const depositAmount = Number(sale.depositAmount || 0).toFixed(2);
  const balanceDue = Number(sale.balanceDue || 0);
  const customerName = sale.customer?.fullName || sale.customerName || 'Cliente';
  const customerPhone = sale.customer?.phone || '';
  const numericAmount = isPendingPayment ? (Number(customAmount) || 0) : balanceDue;
  const numSplit1 = Number(splitAmount1) || 0;
  const numSplit2 = Math.max(0, Number((numericAmount - numSplit1).toFixed(2)));

  const handleReceiptUpload = async (file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return setReceiptUploadError('El comprobante supera el límite de 15MB.');
    setReceiptUploadError(null);
    setIsUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await authFetch('/api/sales/upload-art', { method: 'POST', body: formData });
      const json = await res.json();
      if (res.ok && json.success && json.url) setReceiptUrl(json.url);
      else setReceiptUploadError(json.error || 'Error al subir el comprobante.');
    } catch {
      setReceiptUploadError('Error de conexión al transferir comprobante a la nube.');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (balanceDue <= 0) return setErrorMsg('Esta venta no tiene saldo pendiente.');
    if (isPendingPayment && numericAmount < minDeposit) {
      return setErrorMsg(`Para activar la orden en taller se requiere un anticipo mínimo del 50% (Q ${minDeposit.toFixed(2)}).`);
    }
    if (isPendingPayment && numericAmount > balanceDue + 0.05) {
      return setErrorMsg(`El monto no puede exceder el total de la orden (Q ${balanceDue.toFixed(2)}).`);
    }
    if ((method === 'TRANSFERENCIA' || method === 'TARJETA') && !reference.trim() && !receiptUrl) {
      return setErrorMsg('Para transferencias o tarjeta es requerido el número de boleta o comprobante.');
    }
    if (isSplitPayment) {
      if (numSplit1 <= 0 || numSplit2 <= 0) {
        return setErrorMsg('Ambos montos del pago dividido deben ser mayores a Q 0.00.');
      }
      if ((splitMethod2 === 'TRANSFERENCIA' || splitMethod2 === 'TARJETA') && !reference2.trim() && !receiptUrl) {
        return setErrorMsg('Ingresa la referencia o comprobante para el segundo método de pago.');
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const paymentsPayload = isSplitPayment
      ? [
          { method, amount: Number(numSplit1.toFixed(2)), reference: reference.trim() || null, receiptUrl: receiptUrl || null },
          { method: splitMethod2, amount: Number(numSplit2.toFixed(2)), reference: reference2.trim() || reference.trim() || null, receiptUrl: receiptUrl || null },
        ]
      : [{ method, amount: numericAmount, reference: reference.trim() || null, receiptUrl: receiptUrl || null }];

    try {
      const res = await authFetch(`/api/sales/${sale.id}/balance-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          payments: paymentsPayload,
          notes: notes.trim() || null,
          idempotencyKey,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al registrar el pago.');

      try { confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } }); } catch (_) {}
      const updated = json.data?.sale || json.data || { ...sale, balanceDue: 0, paymentStatus: 'PAGADO_TOTAL' };
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err) {
      console.error('Error procesando pago:', err);
      setErrorMsg(err.message || 'Error en el servidor al registrar el pago.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-neutral-800 rounded-[32px] p-6 max-w-md w-full shadow-2xl text-white space-y-4 animate-fadeIn max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              {isPendingPayment ? 'Registrar Anticipo de Orden' : 'Cobrar Saldo Pendiente'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ficha Resumen de la Orden */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1.5 text-xs">
          <div className="flex items-center justify-between font-mono">
            <span className="text-neutral-400">Orden:</span>
            <span className="text-amber-400 font-bold">{sale.saleNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Cliente:</span>
            <span className="text-white font-semibold truncate max-w-[200px]">{customerName} {customerPhone ? `(${customerPhone})` : ''}</span>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-neutral-800/80 text-neutral-400">
            <span>Total Orden:</span>
            <span className="font-mono text-neutral-300">Q {totalAmount}</span>
          </div>
          {!isPendingPayment && (
            <div className="flex items-center justify-between text-neutral-400">
              <span>Anticipo Previo:</span>
              <span className="font-mono text-neutral-300">- Q {depositAmount}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t border-neutral-800 text-sm font-bold">
            <span className="text-white">{isPendingPayment ? 'Monto a Abonar:' : 'Saldo a Cobrar Hoy:'}</span>
            <span className="font-mono text-emerald-400 text-base">Q {numericAmount.toFixed(2)}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* Si es orden pendiente, permitir ingresar anticipo */}
          {isPendingPayment && (
            <div>
              <label className="block text-neutral-400 font-semibold mb-1">Monto del Abono (Mínimo 50%: Q {minDeposit.toFixed(2)})</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button type="button" onClick={() => setCustomAmount(minDeposit.toString())} className="min-h-[44px] px-2 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold cursor-pointer transition-colors">
                  ⚡ 50% (Q {minDeposit.toFixed(2)})
                </button>
                <button type="button" onClick={() => setCustomAmount(Number(sale.totalAmount).toFixed(2))} className="min-h-[44px] px-2 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold cursor-pointer transition-colors">
                  💯 100% (Q {Number(sale.totalAmount).toFixed(2)})
                </button>
              </div>
              <input type="number" step="any" min={minDeposit} value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} className="w-full min-h-[44px] px-3.5 py-2 bg-black border border-neutral-800 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-400" />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-neutral-400 font-semibold">{isSplitPayment ? 'Método 1' : 'Método de Pago'}</label>
              <button
                type="button"
                onClick={() => {
                  const next = !isSplitPayment;
                  setIsSplitPayment(next);
                  if (next && !splitAmount1) setSplitAmount1(Number((numericAmount / 2).toFixed(2)).toString());
                  setErrorMsg(null);
                }}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                {isSplitPayment ? '✕ Usar 1 solo método' : '+ Dividir pago en 2 métodos'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                const isSel = method === m.id;
                return (
                  <button key={m.id} type="button" onClick={() => { setMethod(m.id); setErrorMsg(null); }} className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${isSel ? 'bg-white text-black border-white shadow-sm font-bold' : 'bg-black text-neutral-400 border-neutral-800 hover:text-white'}`}>
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isSplitPayment && (
            <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-neutral-400 text-[11px] font-semibold mb-1">Monto {method} (Q)</label>
                  <input type="number" step="0.01" min="0.01" max={numericAmount} value={splitAmount1} onChange={(e) => setSplitAmount1(e.target.value)} className="w-full min-h-[44px] px-3 py-1.5 bg-black border border-neutral-800 rounded-xl text-white font-mono font-bold text-xs" />
                </div>
                <div>
                  <label className="block text-neutral-400 text-[11px] font-semibold mb-1">Remanente {splitMethod2} (Q)</label>
                  <div className="w-full min-h-[44px] px-3 py-1.5 bg-black/60 border border-neutral-800 rounded-xl text-emerald-400 font-mono font-bold text-xs flex items-center">Q {numSplit2.toFixed(2)}</div>
                </div>
              </div>
              <div>
                <label className="block text-neutral-400 text-[11px] font-semibold mb-1">Método 2</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button key={m.id} type="button" onClick={() => setSplitMethod2(m.id)} className={`min-h-[44px] px-2 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer ${splitMethod2 === m.id ? 'bg-white text-black border-white shadow-sm font-bold' : 'bg-black text-neutral-400 border-neutral-800 hover:text-white'}`}>{m.label}</button>
                  ))}
                </div>
              </div>
              {(splitMethod2 === 'TRANSFERENCIA' || splitMethod2 === 'TARJETA') && (
                <input type="text" value={reference2} onChange={(e) => setReference2(e.target.value)} placeholder={`Referencia / Boleta ${splitMethod2}`} className="w-full min-h-[44px] px-3 py-1.5 bg-black border border-neutral-800 rounded-xl text-white font-mono text-xs" />
              )}
            </div>
          )}

          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Referencia / No. Boleta {(method === 'TRANSFERENCIA' || method === 'TARJETA') && '*'}</label>
            <input type="text" value={reference} onChange={(e) => { setReference(e.target.value); setErrorMsg(null); }} placeholder={method === 'EFECTIVO' ? 'Opcional para efectivo' : 'Ej. TRANSF-12345'} className="w-full min-h-[44px] px-3.5 py-2 bg-black border border-neutral-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500" />
          </div>

          {/* Adjunto de Comprobante / Voucher */}
          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Comprobante de Pago (Voucher / Foto)</label>
            {receiptUrl ? (
              <div className="flex items-center justify-between gap-3 p-2 bg-black border border-emerald-500/40 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <img src={receiptUrl} alt="Comprobante" className="w-9 h-9 object-cover rounded-lg border border-neutral-700 bg-neutral-900 shrink-0" />
                  <span className="text-xs font-bold text-emerald-400 truncate">✓ Comprobante cargado</span>
                </div>
                <button type="button" onClick={() => setReceiptUrl(null)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-red-400 cursor-pointer rounded-lg hover:bg-neutral-900 transition-colors" title="Quitar comprobante">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="min-h-[44px] px-3 py-2 bg-neutral-900 border border-dashed border-neutral-700 hover:border-amber-500/60 rounded-xl text-xs text-neutral-300 font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors">
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={isUploadingReceipt} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(f); }} />
                {isUploadingReceipt ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Upload className="w-4 h-4 text-amber-400" />}
                <span>{isUploadingReceipt ? 'Subiendo a la nube...' : 'Adjuntar Comprobante (Voucher / Foto)'}</span>
              </label>
            )}
            {receiptUploadError && <span className="text-[11px] text-red-400 block mt-1 font-semibold">⚠️ {receiptUploadError}</span>}
          </div>

          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Notas (Opcional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. Depósito verificado o retiro en tienda" className="w-full min-h-[44px] px-3.5 py-2 bg-black border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500" />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="min-h-[44px] px-4 py-2 rounded-xl text-neutral-400 hover:text-white font-semibold transition-colors cursor-pointer">
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
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isPendingPayment ? `Registrar Anticipo (Q ${numericAmount.toFixed(2)})` : `Cobrar Saldo (Q ${balanceDue.toFixed(2)})`}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
