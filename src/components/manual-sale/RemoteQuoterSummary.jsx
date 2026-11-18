import React, { useState } from 'react';
import { Calculator, Smartphone, CreditCard, Banknote, AlertTriangle, CheckCircle2, Loader2, Upload, X, Clock, Zap, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PAYMENT_METHODS = [
  { id: 'TRANSFERENCIA', label: 'Transferencia', icon: Smartphone },
  { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
  { id: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
];

export default function RemoteQuoterSummary({
  productsSubtotal = 0, productsAmount = 0, discount = 0, effectiveEditionCost = 0, editionDescription = '',
  effectiveShippingCost = 0, totalAmount = 0,
  depositInput = '', setDepositInput, numericDeposit = 0, balanceDue = 0,
  isDepositValid = false, depositPaymentMethod, setDepositPaymentMethod, depositReference, setDepositReference,
  remoteSaleNotes, setRemoteSaleNotes, depositReceiptUrl = null, setDepositReceiptUrl,
  isUploadingReceipt = false, receiptUploadError = null, onUploadReceipt,
  isPendingPaymentOnly = false, setIsPendingPaymentOnly,
  isSubmitting, submitError, onConfirmRemoteSale,
}) {
  const isOverTotal = !isPendingPaymentOnly && totalAmount > 0 && numericDeposit > totalAmount + 0.01;
  const isPaidTotal = !isPendingPaymentOnly && totalAmount > 0 && numericDeposit >= totalAmount && !isOverTotal;

  const authContext = useAuth ? useAuth() : null;
  const authFetch = authContext?.authFetch || window.fetch.bind(window);

  const [isVerifyingOcr, setIsVerifyingOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

  const handleVerifyReceipt = async () => {
    if (!depositReceiptUrl) return;
    setIsVerifyingOcr(true);
    setOcrResult(null);
    try {
      const res = await authFetch('/api/ai/verify-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptUrl: depositReceiptUrl, expectedAmount: numericDeposit }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error verificando comprobante');
      setOcrResult(data);
      if (data.referenceNumber && !depositReference && setDepositReference) {
        setDepositReference(data.referenceNumber);
      }
    } catch (err) {
      setOcrResult({
        detectedAmount: 0,
        expectedAmount: numericDeposit,
        isMatch: false,
        summary: `Fallo en OCR: ${err.message}`,
      });
    } finally {
      setIsVerifyingOcr(false);
    }
  };

  return (
    <div className="space-y-4 p-5 rounded-2xl bg-black border border-neutral-800 text-xs">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <label className="font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
          <Calculator className="w-4 h-4 text-cyan-400" />
          <span>4. Cotizador & Registro de Anticipo</span>
        </label>
        <span className="font-mono text-neutral-400 text-[11px]">Flete: Q {effectiveShippingCost.toFixed(2)}</span>
      </div>

      {/* Desglose Contable de la Orden */}
      <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
        <div className="flex items-center justify-between text-neutral-400"><span>Subtotal Productos:</span><span className="font-mono text-white">Q {productsSubtotal.toFixed(2)}</span></div>
        {discount > 0 && (
          <div className="flex items-center justify-between text-emerald-400"><span>Descuento aplicado:</span><span className="font-mono">- Q {Number(discount).toFixed(2)}</span></div>
        )}
        {effectiveEditionCost > 0 && (
          <div className="flex items-center justify-between text-neutral-300" data-testid="quoter-edition-row" title={editionDescription?.trim() || undefined}>
            <span>Edición de diseño:</span>
            <span className="font-mono text-white">Q {effectiveEditionCost.toFixed(2)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-neutral-400"><span>Envío / Flete:</span><span className="font-mono text-white">Q {effectiveShippingCost.toFixed(2)}</span></div>
        <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-neutral-800 text-white"><span>Total de la Orden:</span><span className="font-mono text-emerald-400 text-base">Q {totalAmount.toFixed(2)}</span></div>
      </div>

      {/* Selector de Modo: Con Anticipo vs Pendiente de Pago */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setIsPendingPaymentOnly && setIsPendingPaymentOnly(false)}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border flex items-center justify-center gap-1.5 text-center ${
            !isPendingPaymentOnly
              ? 'bg-white text-black border-white shadow-sm font-bold'
              : 'bg-black text-neutral-400 border-neutral-800 hover:text-white'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 shrink-0 ${!isPendingPaymentOnly ? 'text-black' : 'text-neutral-400'}`} />
          <span>Con Anticipo</span>
        </button>
        <button
          type="button"
          onClick={() => setIsPendingPaymentOnly && setIsPendingPaymentOnly(true)}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border flex items-center justify-center gap-1.5 text-center ${
            isPendingPaymentOnly
              ? 'bg-white text-black border-white shadow-sm font-bold'
              : 'bg-black text-neutral-400 border-neutral-800 hover:text-white'
          }`}
        >
          <Clock className={`w-3.5 h-3.5 shrink-0 ${isPendingPaymentOnly ? 'text-black' : 'text-neutral-400'}`} />
          <span>Pendiente Pago</span>
        </button>
      </div>

      {isPendingPaymentOnly ? (
        /* Panel Informativo: Orden en Espera de Pago (Sin entrada a taller) */
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 space-y-2">
          <div className="font-bold flex items-center gap-1.5 text-white text-xs">
            <Clock className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>Cotización en espera de transferencia (Q {totalAmount.toFixed(2)})</span>
          </div>
          <p className="text-[11px] text-neutral-300 leading-relaxed">
            La orden se registrará reservada. <strong>No entrará a producción en taller</strong> hasta que se acredite y registre el anticipo.
          </p>
          <input
            type="text"
            value={remoteSaleNotes}
            onChange={(e) => setRemoteSaleNotes(e.target.value)}
            placeholder="Notas del pedido (opcional)..."
            className="w-full min-h-[44px] px-3.5 py-2 mt-1 bg-black border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-white"
          />
        </div>
      ) : (
        <>
          {/* Campo Libre de Anticipo + Botón 100% */}
          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
            <div>
              <label
                htmlFor="remote-deposit-input"
                className="block text-xs font-semibold text-neutral-200 mb-2"
              >
                Valor del anticipo
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  id="remote-deposit-input"
                  type="number"
                  min="0"
                  step="any"
                  value={depositInput}
                  onChange={(e) => setDepositInput(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 min-h-[44px] px-3.5 py-2.5 bg-black border border-neutral-800 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-white"
                />
                <button
                  type="button"
                  onClick={() => setDepositInput(totalAmount > 0 ? totalAmount.toString() : '')}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border flex items-center justify-center gap-1.5 text-center shrink-0 ${
                    isPaidTotal
                      ? 'bg-white text-black border-white shadow-sm font-bold'
                      : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>100% (Q {totalAmount.toFixed(2)})</span>
                </button>
              </div>
            </div>

            {isOverTotal && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>El anticipo no puede superar el total de la orden (Q {totalAmount.toFixed(2)}).</span>
              </div>
            )}

            {isDepositValid && !isPaidTotal && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /><span>Anticipo registrado</span></span>
                <span className="font-bold font-mono">Saldo pendiente: Q {balanceDue.toFixed(2)}</span>
              </div>
            )}

            {isPaidTotal && (
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" /><span>Pago completo (100%)</span></span>
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
                    className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-center transition-colors cursor-pointer border ${
                      isSel ? 'bg-white text-black border-white' : 'bg-black text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input type="text" value={depositReference} onChange={(e) => setDepositReference(e.target.value)} placeholder="No. de Boleta / Transferencia..." className="w-full min-h-[44px] px-3.5 py-2 bg-black border border-neutral-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500" />
              <input type="text" value={remoteSaleNotes} onChange={(e) => setRemoteSaleNotes(e.target.value)} placeholder="Notas del pedido (opcional)..." className="w-full min-h-[44px] px-3.5 py-2 bg-black border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500" />
            </div>

            {/* Comprobante / Voucher de Pago */}
            <div className="space-y-1.5">
              {depositReceiptUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 p-2 bg-black border border-emerald-500/40 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={depositReceiptUrl} alt="Comprobante" className="w-10 h-10 object-cover rounded-lg border border-neutral-700 bg-neutral-900 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-emerald-400 block truncate">Comprobante Adjunto</span>
                        <a href={depositReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-400 hover:text-white underline truncate block">Ver original</a>
                      </div>
                    </div>
                    <button type="button" onClick={() => setDepositReceiptUrl && setDepositReceiptUrl(null)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-red-400 cursor-pointer rounded-lg hover:bg-neutral-900 transition-colors" title="Quitar comprobante">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Botón Acelerador Ferial: Verificar Boleta con OCR */}
                  <button
                    type="button"
                    onClick={handleVerifyReceipt}
                    disabled={isVerifyingOcr}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-neutral-200 font-bold text-xs flex items-center justify-center gap-2 text-center transition-colors cursor-pointer"
                  >
                    {isVerifyingOcr ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                        <span>Escaneando boleta con OCR Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>Verificar Boleta (OCR)</span>
                      </>
                    )}
                  </button>

                  {ocrResult && (
                    <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                      ocrResult.isMatch
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                        : 'bg-red-950/40 border-red-800 text-red-300'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {ocrResult.isMatch ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
                          <span className="font-semibold truncate">{ocrResult.summary}</span>
                        </div>
                        <span className="font-mono font-bold text-[11px] shrink-0 bg-black/60 px-2 py-0.5 rounded border border-neutral-700">
                          Q {ocrResult.detectedAmount !== undefined ? ocrResult.detectedAmount.toFixed(2) : '0.00'}
                        </span>
                      </div>
                      {(ocrResult.bank || ocrResult.referenceNumber) && (
                        <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/80 font-mono">
                          <span>Banco: <strong className="text-white">{ocrResult.bank || 'No detectado'}</strong></span>
                          <span>Ref: <strong className="text-white">{ocrResult.referenceNumber || 'S/N'}</strong></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="flex-1 min-h-[44px] px-3 py-2 bg-neutral-900 border border-dashed border-neutral-700 hover:border-neutral-500 rounded-xl text-xs text-neutral-300 font-semibold flex items-center justify-center gap-2 text-center cursor-pointer transition-colors">
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={isUploadingReceipt} onChange={(e) => { const f = e.target.files?.[0]; if (f && onUploadReceipt) onUploadReceipt(f); }} />
                    {isUploadingReceipt ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" /> : <Upload className="w-4 h-4 text-cyan-400 shrink-0" />}
                    <span>{isUploadingReceipt ? 'Subiendo voucher a la nube...' : 'Adjuntar Comprobante (Voucher / Foto)'}</span>
                  </label>
                </div>
              )}
              {receiptUploadError && <span className="text-[11px] text-red-400 block font-semibold">{receiptUploadError}</span>}
            </div>
          </div>
        </>
      )}

      {submitError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Botón Primario de Confirmación */}
      <button
        type="button"
        disabled={!isDepositValid || isSubmitting}
        onClick={onConfirmRemoteSale}
        className={`w-full min-h-[48px] px-6 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 text-center transition-all cursor-pointer shadow-xl active:scale-95 ${
          !isDepositValid || isSubmitting
            ? 'opacity-40 pointer-events-none bg-neutral-800 text-neutral-500 border border-neutral-700'
            : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
        }`}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin shrink-0" />
            <span>Registrando venta...</span>
          </>
        ) : (
          <span>{`Registrar Venta (abono Q ${numericDeposit.toFixed(2)})`}</span>
        )}
      </button>
    </div>
  );
}
