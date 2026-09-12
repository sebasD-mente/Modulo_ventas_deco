import React from 'react';
import { ShoppingBag, RefreshCw, Trash2, X, Plus, Minus, CheckCircle2, Loader2 } from 'lucide-react';
import { DEFAULT_EVENT_SIZES } from './chatConstants';

export default function ChatDraftCard({
  pendingDraft, onUpdateSize, updateDraftItemSize, onUpdateQty, updateDraftItemQty,
  onRemoveItem, removeDraftItem, onUpdatePaymentMethod, updateDraftPaymentMethod,
  onDiscard, discardDraft, onConfirmSale, confirmPendingSale,
  onPopulateManualForm, transferDraftToManualForm, onOpenSwapModal, openSwapModal, isLoading
}) {
  if (!pendingDraft) return null;
  const updateSize = onUpdateSize || updateDraftItemSize;
  const updateQty = onUpdateQty || updateDraftItemQty;
  const removeItem = onRemoveItem || removeDraftItem;
  const updatePayment = onUpdatePaymentMethod || updateDraftPaymentMethod;
  const discard = onDiscard || discardDraft;
  const confirm = onConfirmSale || confirmPendingSale;
  const openSwap = onOpenSwapModal || openSwapModal;
  const getSizes = (it) => { const raw = it.availableSizes?.length ? it.availableSizes : DEFAULT_EVENT_SIZES; return raw.some((s) => s.sizeId === 'PORTADA_ALBUM') ? raw : [...raw, DEFAULT_EVENT_SIZES.find((s) => s.sizeId === 'PORTADA_ALBUM') || { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', precio: 55 }]; };

  const handleModify = () => {
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
    <div className="p-4 rounded-[26px] bg-[#1a1a1a] border-2 border-emerald-500/80 shadow-2xl space-y-3 animate-fadeIn text-white">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
        <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <ShoppingBag className="w-4 h-4" /> Borrador de Venta (Pendiente de Confirmar)
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-400">Canal: <strong className="text-white">{pendingDraft.inputChannel || 'IA_CHAT_TEXTO'}</strong></span>
          <button type="button" onClick={discard} className="text-neutral-400 hover:text-red-400 p-1 rounded transition-colors cursor-pointer" title="Descartar borrador">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
        {(pendingDraft.items || []).map((it, idx) => (
          <div key={idx} className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-black border border-neutral-800 text-xs">
            <img src={it.thumbUrl || it.imageUrl} alt="" className="w-10 h-14 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900" />
            <div className="flex-1 min-w-0">
              <span className="font-bold text-white block truncate">{it.baseTitle || it.description}</span>
              <span className="text-[9px] text-neutral-400 uppercase font-semibold block">{it.category || 'ARTE'}</span>
              <div className="flex items-center gap-1.5 mt-1">
                <label className="text-[10px] text-neutral-400 font-medium">Tamaño:</label>
                <select
                  value={it.sizeId || 'MEDIANO'}
                  onChange={(e) => updateSize?.(idx, e.target.value)}
                  className="bg-[#222222] border border-neutral-700 rounded px-2 py-0.5 text-[10px] text-white font-bold focus:outline-none focus:border-white cursor-pointer"
                >
                  {getSizes(it).map((s) => (
                    <option key={s.sizeId} value={s.sizeId}>{s.nombre} (Q{s.precio})</option>
                  ))}
                </select>
              </div>
              {openSwap && (
                <button type="button" onClick={() => openSwap(idx)} className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1 underline transition-colors cursor-pointer mt-1">
                  <RefreshCw className="w-2.5 h-2.5" /> Cambiar diseño
                </button>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1 bg-[#222] border border-neutral-700 rounded-lg p-0.5">
                <button type="button" onClick={() => updateQty?.(idx, -1)} className="w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-white rounded hover:bg-neutral-800 cursor-pointer">
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <span className="font-bold text-xs text-white px-1">{it.quantity}</span>
                <button type="button" onClick={() => updateQty?.(idx, 1)} className="w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-white rounded hover:bg-neutral-800 cursor-pointer">
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
              <span className="font-black text-xs text-emerald-400">Q{(it.quantity * it.unitPrice).toFixed(2)}</span>
              <button type="button" onClick={() => removeItem?.(idx)} className="text-neutral-500 hover:text-red-400 p-0.5 transition-colors cursor-pointer" title="Eliminar este póster">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-neutral-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updatePayment?.(m)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  pendingDraft.paymentMethod === m ? 'bg-white text-black border-white' : 'bg-black border-neutral-700 text-neutral-400 hover:text-white'
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

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-800">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={discard} className="px-3 py-1 rounded-lg bg-black hover:bg-red-950/50 hover:text-red-400 text-neutral-400 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer">
              Descartar
            </button>
            <button type="button" onClick={handleModify} className="px-3 py-1 rounded-lg bg-black hover:bg-neutral-800 text-neutral-300 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer">
              Modificar
            </button>
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={isLoading}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer transition-transform active:scale-95"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Confirmar Venta</span>
          </button>
        </div>
      </div>
    </div>
  );
}
