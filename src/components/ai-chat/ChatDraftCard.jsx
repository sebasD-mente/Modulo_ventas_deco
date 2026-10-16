import React, { useRef, useEffect, useState } from 'react';
import { ShoppingBag, RefreshCw, Trash2, X, Plus, Minus, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { DEFAULT_EVENT_SIZES } from './chatConstants';
import DraftItemRow from './DraftItemRow';

export default function ChatDraftCard({
  pendingDraft, onUpdateSize, updateDraftItemSize, onUpdateQty, updateDraftItemQty,
  onRemoveItem, removeDraftItem, onUpdatePaymentMethod, updateDraftPaymentMethod,
  onDiscard, discardDraft, onConfirmSale, confirmPendingSale,
  onPopulateManualForm, transferDraftToManualForm, onOpenSwapModal, openSwapModal,
  onSelectVariant, isLoading
}) {
  const draftCardRef = useRef(null);
  const [autoCommitSeconds, setAutoCommitSeconds] = useState(null);
  const autoCommitTimerRef = useRef(null);

  if (!pendingDraft) return null;
  const updateSize = onUpdateSize || updateDraftItemSize;
  const updateQty = onUpdateQty || updateDraftItemQty;
  const removeItem = onRemoveItem || removeDraftItem;
  const updatePayment = onUpdatePaymentMethod || updateDraftPaymentMethod;
  const discard = onDiscard || discardDraft;
  const confirm = onConfirmSale || confirmPendingSale;
  const openSwap = onOpenSwapModal || openSwapModal;
  const getSizes = (it) => (Array.isArray(it.availableSizes) && it.availableSizes.length > 0 ? it.availableSizes : DEFAULT_EVENT_SIZES);

  useEffect(() => {
    draftCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [pendingDraft]);

  // Auto-commit con Deshacer (8s) si la orden tiene 100% de certeza y método de pago
  useEffect(() => {
    const isEligible = Boolean(
      (pendingDraft.autoCommitEligible || (pendingDraft.items?.length > 0 && pendingDraft.paymentMethod && !pendingDraft.unmatchedItems?.length)) &&
      autoCommitSeconds === null
    );
    if (isEligible) {
      setAutoCommitSeconds(8);
      autoCommitTimerRef.current = setInterval(() => {
        setAutoCommitSeconds((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(autoCommitTimerRef.current);
            confirm?.();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (autoCommitTimerRef.current) clearInterval(autoCommitTimerRef.current);
    };
  }, [pendingDraft.autoCommitEligible]);

  const cancelAutoCommit = () => {
    if (autoCommitTimerRef.current) clearInterval(autoCommitTimerRef.current);
    setAutoCommitSeconds(null);
  };

  const handleModify = () => {
    cancelAutoCommit();
    if (transferDraftToManualForm) { transferDraftToManualForm(); return; }
    if (onPopulateManualForm) {
      const atts = Array.isArray(pendingDraft.attachments) && pendingDraft.attachments.length
        ? pendingDraft.attachments
        : pendingDraft.audioUrl ? [{ fileUrl: pendingDraft.audioUrl, fileType: 'AUDIO_VOZ', transcription: pendingDraft.transcription || null }]
        : pendingDraft.imageUrl ? [{ fileUrl: pendingDraft.imageUrl, fileType: pendingDraft.inputChannel === 'IA_IMAGEN_QR' ? 'FOTO_QR' : 'FOTO_ARTE' }] : [];
      const items = (pendingDraft.items || []).map((it) => ({ ...it, selectedSizeId: it.selectedSizeId || it.sizeId || null, sizeId: it.sizeId || it.selectedSizeId || null }));
      onPopulateManualForm({ ...pendingDraft, inputChannel: pendingDraft.inputChannel || 'IA_CHAT_TEXTO', attachments: atts, items });
      discard?.();
    }
  };

  return (
    <div
      ref={draftCardRef}
      className="p-4 rounded-[26px] bg-[#1a1a1a] border-2 border-emerald-500/80 shadow-2xl space-y-3 animate-fadeIn text-white draft-card"
      data-testid="poster-card"
    >
      {autoCommitSeconds !== null && (
        <div className="p-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-xs text-emerald-300 flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>⚡ Orden lista. Auto-confirmando en <strong>{autoCommitSeconds}s</strong>...</span>
          </div>
          <button
            type="button"
            onClick={cancelAutoCommit}
            className="min-h-[38px] px-3 rounded-xl bg-red-950/90 hover:bg-red-900 border border-red-500/50 text-red-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Deshacer ({autoCommitSeconds}s)
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
        <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <ShoppingBag className="w-4 h-4" /> Borrador de Venta (Pendiente de Confirmar)
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-400">Canal: <strong className="text-white">{pendingDraft.inputChannel || 'IA_CHAT_TEXTO'}</strong></span>
          <button type="button" onClick={() => { cancelAutoCommit(); discard?.(); }} className="text-neutral-400 hover:text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors cursor-pointer" title="Descartar borrador">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {pendingDraft.unmatchedItems?.length > 0 && (() => {
        const unmatched = pendingDraft.unmatchedItems;
        return (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
            <div className="space-y-2">
              {unmatched.map((u, idx) => {
                const isConflict = u.sizeAvailable === false || u.unavailableReason || u.sizeConflict;
                const name = u.PosterName || u.rawName || u.baseTitle || u.title || 'Obra';
                return (
                  <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-amber-950/20 border border-amber-500/20">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate">
                        <span className="text-amber-400 font-bold mr-1">⚠️</span>
                        {name} {u.quantity > 1 ? `(${u.quantity} uds)` : ''}
                      </div>
                      <div className="text-[11px] text-amber-400/80 truncate">
                        {isConflict ? (u.unavailableReason || 'Formato no disponible') : 'No encontrada en catálogo'} (No sumado)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openSwap && openSwap(`unmatched:${idx}`, u.PosterName || u.rawName || '')}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 text-amber-200 hover:text-white border border-amber-500/40 text-[11px] font-bold shrink-0 transition-colors"
                    >
                      🔍 Buscar reemplazo
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  if (openSwap) {
                    if (unmatched.length === 1) {
                      openSwap('unmatched:0', unmatched[0]?.PosterName || unmatched[0]?.rawName || '');
                    } else {
                      openSwap(-1, '');
                    }
                  }
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                🔍 Buscar en catálogo
              </button>
            </div>
          </div>
        );
      })()}

      <div className="text-[11px] font-bold text-neutral-400 px-1 flex items-center justify-between">
        <span>{pendingDraft.items?.length || 0} obra(s) en este pedido:</span>
        <span className="text-[10px] text-neutral-500 font-mono">Toca la talla para cambiar</span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
        {(pendingDraft.items || []).map((it, idx) => (
          <DraftItemRow
            key={idx}
            item={it}
            index={idx}
            onUpdateSize={updateSize}
            onUpdateQty={updateQty}
            onRemoveItem={removeItem}
            onOpenSwap={openSwap}
            onSelectVariant={onSelectVariant}
            availableSizes={getSizes(it)}
          />
        ))}
      </div>

      <div className="pt-2 border-t border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updatePayment?.(m)}
                className={`min-h-[44px] min-w-[44px] text-xs font-bold px-3 py-2 rounded-xl border transition-colors cursor-pointer flex items-center justify-center ${
                  pendingDraft.paymentMethod === m ? 'bg-white text-black border-white shadow-md' : 'bg-black border-neutral-700 text-neutral-400 hover:text-white'
                }`}
              >
                {m === 'EFECTIVO' ? '💵 Efectivo' : m === 'TARJETA' ? '💳 Tarjeta' : '📱 Transfer'}
              </button>
            ))}
          </div>
          <div className="text-right">
            {Number(pendingDraft.discount || 0) > 0 && <span className="block text-[10px] text-amber-400 font-semibold">Desc: -Q{Number(pendingDraft.discount).toFixed(2)}</span>}
            <span className="text-[10px] text-neutral-400 mr-1">{Number(pendingDraft.discount || 0) > 0 ? 'Total Neto:' : 'Total:'}</span>
            <strong className="text-emerald-400 text-sm font-black">Q {Number(Math.max(0, (pendingDraft.total || 0) - (pendingDraft.discount || 0))).toFixed(2)}</strong>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-neutral-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { cancelAutoCommit(); discard?.(); }}
              className="flex-1 sm:flex-none min-h-[44px] px-3.5 py-2 rounded-xl bg-black hover:bg-red-950/50 hover:text-red-400 text-neutral-400 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer flex items-center justify-center"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={handleModify}
              className="flex-1 sm:flex-none min-h-[44px] px-3.5 py-2 rounded-xl bg-black hover:bg-neutral-800 text-cyan-300 text-xs font-bold border border-cyan-500/40 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Continuar en Venta Manual</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => { cancelAutoCommit(); confirm?.(); }}
            disabled={isLoading}
            className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-transform active:scale-95"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            <span>Confirmar Venta</span>
          </button>
        </div>
      </div>
    </div>
  );
}
