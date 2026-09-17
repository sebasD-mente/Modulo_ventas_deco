import React from 'react';
import { AlertTriangle, X, ShoppingBag, RotateCcw } from 'lucide-react';

export default function AiErrorBanner({ error, onDismiss, onManualSale, onRetryAudio, hasAudioRetry }) {
  if (!error) return null;
  const handleRetry = onRetryAudio || error?.onRetryAudio || error?.onRetry;
  const canRetryAudio = (hasAudioRetry !== undefined ? hasAudioRetry : (error?.hasAudioRetry ?? error?.canRetry)) && Boolean(handleRetry);

  return (
    <div
      role="alert" aria-live="assertive"
      className="mx-3 sm:mx-4 my-2 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 to-red-500/20 border border-amber-500/40 text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-lg backdrop-blur-sm animate-fadeIn select-none"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-amber-300 truncate">{error.title || 'Fallo en inferencia de IA'}</p>
          <p className="text-[11px] text-amber-200/90 leading-tight">{error.message}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <button
          type="button" onClick={onDismiss} aria-label="Descartar aviso" title="Descartar aviso"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-xl border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <button
          type="button" onClick={onManualSale}
          className="min-h-[44px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs flex items-center gap-1.5 shadow cursor-pointer transition-transform active:scale-95"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Cargar Manual</span>
        </button>
        {canRetryAudio && (
          <button
            type="button" onClick={handleRetry} aria-label="Reintentar Audio" title="Reintentar envío del audio"
            className="min-h-[44px] px-3.5 rounded-xl bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-amber-500/50 cursor-pointer transition-all active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reintentar Audio</span>
          </button>
        )}
      </div>
    </div>
  );
}
