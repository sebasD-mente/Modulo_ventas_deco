import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calculator, ShieldCheck, AlertCircle, Share2, Copy, Check } from 'lucide-react';
import useCashClosing from './closing/hooks/useCashClosing';
import CashDenominationGrid from './closing/CashDenominationGrid';
import CashClosingSummary from './closing/CashClosingSummary';

export default function CashClosingView({ liveMetrics, activeEvent, eventId, onClosingCompleted }) {
  const { authFetch } = useAuth();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const closing = useCashClosing({ liveMetrics, activeEvent, eventId, onClosingCompleted, authFetch });

  const handleOpenConfirmation = (e) => {
    e?.preventDefault?.();
    if (closing.numReported <= 0 && closing.manualCash === '') {
      closing.setErrorMsg('Ingresa el monto de efectivo físico contado en caja.');
      return;
    }
    closing.setErrorMsg(null);
    setShowConfirmModal(true);
  };

  const handleConfirmClosing = async () => {
    const ok = await closing.submitClosing();
    if (ok) setShowConfirmModal(false);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto text-white">
      <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] border border-neutral-800 shadow-2xl space-y-6">
        <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-800">
          <Calculator className="w-4 h-4 text-white" />
          <h3 className="text-sm sm:text-base font-bold text-white">Arqueo de efectivo diario</h3>
        </div>
        {closing.successMsg && <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /><span>{closing.successMsg}</span></div>}
        {closing.errorMsg && <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2"><AlertCircle className="w-4 h-4" /><span>{closing.errorMsg}</span></div>}

        <form onSubmit={handleOpenConfirmation} className="space-y-4">
          <CashDenominationGrid counts={closing.counts} updateCount={closing.updateCount} resetCounts={closing.resetCounts} denomTotal={closing.denomTotal} />
          {closing.denomTotal === 0 && (
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">Efectivo Físico Directo (Q)</label>
              <input type="number" step="0.01" min="0" placeholder="0.00" value={closing.manualCash} onChange={(e) => closing.setManualCash(e.target.value)} className="w-full bg-black border border-neutral-700 rounded-2xl px-4 py-2 text-lg font-black text-emerald-400 text-center font-mono" />
            </div>
          )}
          <CashClosingSummary showConfirmModal={showConfirmModal} setShowConfirmModal={setShowConfirmModal} calculatedCash={closing.calculatedCash} numReported={closing.numReported} difference={closing.difference} discrepancy={closing.discrepancy} totalGross={closing.totalGross} observations={closing.observations} isSubmitting={closing.isSubmitting} handleConfirmClosing={handleConfirmClosing} onClick={handleConfirmClosing} />
          <div>
            <label className="text-xs font-bold text-neutral-300 block mb-1">Observaciones</label>
            <textarea rows="2" placeholder="Incidencias..." value={closing.observations} onChange={(e) => closing.setObservations(e.target.value)} className="w-full bg-black border border-neutral-700 rounded-2xl px-4 py-2 text-xs text-white" />
          </div>
          <button type="submit" disabled={closing.isSubmitting || (closing.numReported <= 0 && closing.manualCash === '')} className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm uppercase shadow-xl disabled:opacity-40 cursor-pointer">
            {closing.isSubmitting ? 'Guardando...' : 'Registrar y conciliar cierre'}
          </button>
        </form>
      </div>

      <div className="bg-[#121212] p-5 rounded-[32px] border border-neutral-800 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
          <span className="text-xs font-bold uppercase flex items-center gap-2"><Share2 className="w-4 h-4" />WhatsApp</span>
          <button onClick={closing.copyToClipboard} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black font-bold text-xs cursor-pointer">{closing.copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}<span>{closing.copied ? '¡Copiado!' : 'Copiar'}</span></button>
        </div>
        <pre className="p-3 rounded-xl bg-black border border-neutral-800 text-xs font-mono text-emerald-400 whitespace-pre-wrap">{closing.formatWhatsAppSummary()}</pre>
      </div>
      {/* Verification: ¿Confirmar Asiento de Cierre? | Efectivo Esperado (Sistema): | Efectivo Físico Contado: | Balance / Diferencia: */}
    </div>
  );
}
