import React, { useState } from 'react';
import { X, CheckCircle2, Loader2, AlertCircle, FileText } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ConfirmSettlementModal({
  isOpen,
  onClose,
  seller,
  calculatedSelection,
  onConfirm,
  isSubmitting,
}) {
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await onConfirm({ notes });
      if (res?.success) {
        try {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        } catch (_) {}
        setNotes('');
        onClose();
      } else if (res?.error) {
        setErrorMsg(res.error);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error emitiendo liquidación');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-[#121212] border border-neutral-800 rounded-[32px] p-5 sm:p-6 max-w-md w-full shadow-2xl text-white space-y-4">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Emitir Liquidación Oficial
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen Contable */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 space-y-2.5 text-xs font-mono">
          <div className="flex justify-between items-center text-neutral-300">
            <span className="text-neutral-400 font-sans">Vendedor:</span>
            <span className="font-bold text-white truncate max-w-[200px]">
              {seller?.fullName || 'Vendedor Seleccionado'}
            </span>
          </div>
          <div className="flex justify-between items-center text-neutral-300">
            <span className="text-neutral-400 font-sans">Órdenes Seleccionadas:</span>
            <span className="font-bold text-white">{calculatedSelection?.count || 0}</span>
          </div>
          <div className="flex justify-between items-center text-neutral-300">
            <span className="text-neutral-400 font-sans">Base Imponible (Productos):</span>
            <span className="font-bold text-white">
              Q {(calculatedSelection?.baseAmount || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center text-neutral-300">
            <span className="text-neutral-400 font-sans">Tasa de Comisión:</span>
            <span className="font-bold text-emerald-400">20.00%</span>
          </div>
          <div className="pt-2 border-t border-neutral-800 flex justify-between items-center text-sm">
            <span className="font-bold text-white font-sans">Total a Liquidar:</span>
            <span className="font-bold text-emerald-400 text-base">
              Q {(calculatedSelection?.commissionAmount || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Formulario con Notas Opcionales */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-neutral-400 font-medium mb-1.5">
              Notas Administrativas (Opcional):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Ej. Liquidación quincenal acordada vía transferencia..."
              className="w-full px-3.5 py-2.5 bg-black border border-neutral-700/90 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Botones de Acción Accesibles (>= 44px) */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (calculatedSelection?.count || 0) === 0}
              className="min-h-[44px] px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Liquidación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
