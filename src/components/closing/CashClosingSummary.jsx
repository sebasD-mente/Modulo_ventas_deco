import React from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

export default function CashClosingSummary({
  showConfirmModal, setShowConfirmModal, calculatedCash = 0, numReported = 0,
  difference = 0, discrepancy, totalGross = 0, observations, isSubmitting,
  handleConfirmClosing, onClick,
}) {
  const onConfirm = onClick || handleConfirmClosing;
  const diffDisplay = difference === 0 ? 'Q 0.00 (Cuadrada)' : difference > 0 ? `+Q ${difference.toFixed(2)} (Sobrante)` : `-Q ${Math.abs(difference).toFixed(2)} (Faltante)`;

  return (
    <>
      <div className="space-y-3">
        <div className="p-3.5 rounded-2xl bg-black border border-neutral-800 flex items-center justify-between text-xs">
          <span className="font-medium text-neutral-400">Efectivo Esperado (Sistema):</span>
          <span className="text-base font-black text-white font-mono">Q {calculatedCash.toFixed(2)}</span>
        </div>
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${discrepancy?.badgeClass || 'text-emerald-400 border-emerald-500/30'}`}>
          <span className="text-xs font-bold uppercase tracking-wider">{discrepancy?.label || 'Balance / Diferencia:'}</span>
          <span className="text-base font-black font-mono">{difference >= 0 ? `+Q ${difference.toFixed(2)}` : `-Q ${Math.abs(difference).toFixed(2)}`}</span>
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm select-none">
          <div className="bg-[#141414] border border-neutral-800 rounded-[32px] max-w-md w-full p-6 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>¿Confirmar Asiento de Cierre?</span>
              </div>
              <button type="button" disabled={isSubmitting} onClick={() => setShowConfirmModal(false)} className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Esta acción registrará el arqueo contable en <strong>PostgreSQL</strong> con política de inmutabilidad contable (<code>Restrict</code>). Una vez asentado, no podrá ser revertido. Verifica el desglose:
            </p>
            <div className="p-4 rounded-2xl bg-black border border-neutral-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-neutral-400">
                <span>Efectivo Esperado (Sistema):</span>
                <span className="font-mono font-bold text-white">Q {calculatedCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-400">
                <span>Efectivo Físico Contado:</span>
                <span className="font-mono font-bold text-emerald-400">Q {numReported.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-neutral-800/80 flex justify-between items-center">
                <span className="font-bold text-neutral-300">Balance / Diferencia:</span>
                <span className={`font-mono font-black ${difference < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{diffDisplay}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-400 pt-1">
                <span>Total Facturado del Evento:</span>
                <span className="font-mono text-white">Q {totalGross.toFixed(2)}</span>
              </div>
            </div>
            {observations && (
              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-300">
                <span className="font-bold text-neutral-400 block mb-0.5">Observaciones:</span>
                <p className="italic">{observations}</p>
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button type="button" disabled={isSubmitting} onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 rounded-2xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold">
                Cancelar
              </button>
              <button type="button" disabled={isSubmitting} onClick={onConfirm} className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50">
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Asentando...</span></> : <span>Sí, Asentar Cierre</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
