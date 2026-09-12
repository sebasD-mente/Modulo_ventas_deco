import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import confetti from 'canvas-confetti';
import { DEFAULT_EVENT_SIZES, buildOfflineFallbackReply } from '../chatConstants';

const TOOL_EVENT_MAP = { suggested_posters: 'suggestedPosters', event_kpis: 'eventKpis', cash_drawer_status: 'cashDrawerStatus', seller_shift_report: 'sellerShiftReport', production_queue_status: 'productionQueueStatus', inventory_stock: 'inventoryStock' };

export function useAiChatStream({ eventId, onSaleRegistered, onPopulateManualForm } = {}) {
  const { authFetch } = useAuth(), [messages, setMessages] = useState([{ id: 1, sender: 'ai', text: '¡Hola! Soy STAND IA y estoy listo para registrar ventas y dar reportes, ¿con qué comenzamos?', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
  const [inputText, setInputText] = useState(''), [isLoading, setIsLoading] = useState(false), [processingNote, setProcessingNote] = useState('');
  const [pendingDraft, setPendingDraft] = useState(null), [swappingIndex, setSwappingIndex] = useState(null), [swapQuery, setSwapQuery] = useState(''), [swapResults, setSwapResults] = useState([]), [isSearchingSwap, setIsSearchingSwap] = useState(false);
  const abortControllerRef = useRef(null), rafIdRef = useRef(null), swapDebounceRef = useRef(null);

  const getNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const pushAiMsg = (text) => setMessages((p) => [...p, { id: Date.now() + 1, sender: 'ai', text, timestamp: getNow() }]);
  const recalculateTotal = (items) => Number(items.reduce((s, i) => s + (i.subtotal || i.quantity * i.unitPrice), 0).toFixed(2));
  const cancelRaf = () => { if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; } };
  const getAtts = (p) => Array.isArray(p.attachments) && p.attachments.length ? p.attachments : p.audioUrl ? [{ fileUrl: p.audioUrl, fileType: 'AUDIO_VOZ', transcription: p.transcription || null }] : p.imageUrl ? [{ fileUrl: p.imageUrl, fileType: p.inputChannel === 'IA_IMAGEN_QR' ? 'FOTO_QR' : 'FOTO_ARTE' }] : [];

  const updateDraftItemSize = (idx, newSizeId) => pendingDraft?.items?.[idx] && setPendingDraft((prev) => {
    const items = [...prev.items], it = items[idx], sizes = it.availableSizes?.length ? it.availableSizes : DEFAULT_EVENT_SIZES, target = sizes.find((s) => s.sizeId === newSizeId) || sizes[0];
    items[idx] = { ...it, sizeId: target.sizeId, unitPrice: Number(target.precio), subtotal: Number((it.quantity * Number(target.precio)).toFixed(2)), description: `${it.baseTitle || it.description.replace(/\s*\([^)]*\)\s*$/, '').trim()} (${target.nombre})` };
    return { ...prev, items, total: recalculateTotal(items) };
  });
  const updateDraftItemQty = (idx, delta) => pendingDraft?.items?.[idx] && setPendingDraft((prev) => {
    const items = [...prev.items], qty = Math.max(1, items[idx].quantity + delta);
    items[idx] = { ...items[idx], quantity: qty, subtotal: Number((qty * items[idx].unitPrice).toFixed(2)) };
    return { ...prev, items, total: recalculateTotal(items) };
  });
  const removeDraftItem = (idx) => pendingDraft?.items?.[idx] && setPendingDraft((p) => {
    const items = p.items.filter((_, i) => i !== idx); return items.length ? { ...p, items, total: recalculateTotal(items) } : null;
  });
  const updateDraftPaymentMethod = (method) => setPendingDraft((p) => (p ? { ...p, paymentMethod: method } : null)), discardDraft = () => setPendingDraft(null);

  const addPosterToDraft = (poster) => {
    const sizes = poster.sizes?.length ? poster.sizes : DEFAULT_EVENT_SIZES, def = sizes.find((s) => s.sizeId === 'MEDIANO') || sizes[0], title = poster.subtitulo ? `${poster.titulo} - ${poster.subtitulo}` : poster.titulo, uPrice = Number(def.precio);
    const item = { productId: poster.id, webPosterId: poster.id, description: `${title} (${def.nombre})`, baseTitle: title, category: poster.categoria, thumbUrl: poster.thumbUrl || poster.imageUrl, imageUrl: poster.imageUrl, quantity: 1, unitPrice: uPrice, subtotal: uPrice, sizeId: def.sizeId, availableSizes: sizes };
    setPendingDraft((p) => p ? { ...p, items: [...p.items, item], total: recalculateTotal([...p.items, item]) } : { items: [item], total: uPrice, paymentMethod: 'EFECTIVO', inputChannel: 'IA_CHAT_TEXTO', notes: 'Venta iniciada desde catálogo sugerido' });
  };

  const fetchInitialSwapPosters = async () => { try { setIsSearchingSwap(true); const res = await authFetch('/api/catalog/web-posters?limit=8'), json = await res.json(); if (json.success) setSwapResults(json.data || []); } catch (e) { console.error(e); } finally { setIsSearchingSwap(false); } }, openSwapModal = (idx) => { setSwappingIndex(idx); setSwapQuery(''); setSwapResults([]); fetchInitialSwapPosters(); }, closeSwapModal = () => { setSwappingIndex(null); setSwapQuery(''); setSwapResults([]); };
  const handleSwapSearchChange = (text) => {
    setSwapQuery(text); if (swapDebounceRef.current) clearTimeout(swapDebounceRef.current);
    swapDebounceRef.current = setTimeout(async () => { setIsSearchingSwap(true); try { const res = await authFetch(`/api/catalog/web-posters?q=${encodeURIComponent(text.trim())}&limit=8`), json = await res.json(); if (json.success) setSwapResults(json.data || []); } catch (err) { console.error(err); } finally { setIsSearchingSwap(false); } }, 150);
  };
  const selectSwapPoster = (newPoster) => {
    if (swappingIndex === null || !pendingDraft) return;
    setPendingDraft((prev) => {
      const items = [...prev.items], cur = items[swappingIndex], sizes = newPoster.sizes?.length ? newPoster.sizes : DEFAULT_EVENT_SIZES, target = sizes.find((s) => s.sizeId === cur.sizeId) || sizes.find((s) => s.sizeId === 'MEDIANO') || sizes[0], title = newPoster.subtitulo ? `${newPoster.titulo} - ${newPoster.subtitulo}` : newPoster.titulo, qty = cur.quantity || 1, uPrice = Number(target.precio);
      items[swappingIndex] = { productId: newPoster.id, webPosterId: newPoster.id, description: `${title} (${target.nombre})`, baseTitle: title, category: newPoster.categoria, thumbUrl: newPoster.thumbUrl || newPoster.imageUrl, imageUrl: newPoster.imageUrl, quantity: qty, unitPrice: uPrice, subtotal: Number((qty * uPrice).toFixed(2)), sizeId: target.sizeId, availableSizes: sizes };
      return { ...prev, items, total: recalculateTotal(items) };
    }); closeSwapModal();
  };

  const uploadMedia = async (url, form, userText, note, onDone) => {
    setIsLoading(true); setProcessingNote(note);
    setMessages((p) => [...p, { id: Date.now(), sender: 'user', text: userText, timestamp: getNow() }]);
    try {
      const res = await authFetch(url, { method: 'POST', body: form }), data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error procesando');
      setPendingDraft(data.draftSale); onDone(data);
    } catch (err) { pushAiMsg(`⚠️ ${err.message}`); }
    finally { setIsLoading(false); setProcessingNote(''); }
  };
  const handleVoiceUpload = (audioBlob) => {
    const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('aac') ? 'aac' : 'webm', form = new FormData(); form.append('audio', audioBlob, `voice-sale.${ext}`); form.append('eventId', eventId);
    uploadMedia('/api/ai/voice-sale', form, '🎙️ [Venta dictada por voz]', 'Gemini analizando dictado de voz y buscando obras en catálogo...', (d) => pushAiMsg(`Entendí tu dictado: "${d.draftSale?.transcription || 'Venta extraída'}". Puedes cambiar tamaño o diseño en la tarjeta antes de confirmar:`));
  };
  const handleImageUpload = (e) => {
    const file = e?.target?.files?.[0]; if (!file) return;
    const form = new FormData(); form.append('image', file, file.name); form.append('eventId', eventId);
    uploadMedia('/api/ai/recognize-artwork', form, '📷 [Foto de obra enviada para reconocimiento visual]', 'Gemini Vision analizando arte contra los 233 pósters del catálogo...', (d) => pushAiMsg(`Reconocí la obra: "${d.primaryTitle || 'Póster identificado'}". Detalle: ${d.visualAnalysis || ''}`));
    if (e.target) e.target.value = '';
  };

  const confirmPendingSale = async () => {
    if (!pendingDraft?.items?.length) return;
    setIsLoading(true); setProcessingNote('Asentando venta inmutable en PostgreSQL...');
    const grandTotal = recalculateTotal(pendingDraft.items);
    const salePayload = { eventId, items: pendingDraft.items.map((i) => ({ productId: i.productId || null, description: i.description, quantity: i.quantity, unitPrice: Number(i.unitPrice) })), payments: [{ method: pendingDraft.paymentMethod || 'EFECTIVO', amount: grandTotal, reference: pendingDraft.notes || null }], discount: Number(pendingDraft.discount || 0), notes: pendingDraft.notes || null, inputChannel: pendingDraft.inputChannel || 'IA_CHAT_TEXTO', attachments: getAtts(pendingDraft) };
    try {
      const res = await authFetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(salePayload) }), json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error registrando la venta');
      try { confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 }, colors: ['#F59E0B', '#10B981', '#3B82F6'] }); } catch (_) {}
      pushAiMsg(`🎉 ¡Venta ${json.data.saleNumber} asentada con éxito por Q ${grandTotal.toFixed(2)} en PostgreSQL!`);
      setPendingDraft(null); if (onSaleRegistered) onSaleRegistered(json.data);
    } catch (err) { console.error(err); alert(`Error confirmando venta: ${err.message}`); } finally { setIsLoading(false); setProcessingNote(''); }
  };

  const transferDraftToManualForm = () => {
    if (!onPopulateManualForm || !pendingDraft) return;
    const items = (pendingDraft.items || []).map((it) => ({ ...it, selectedSizeId: it.selectedSizeId || it.sizeId || null, sizeId: it.sizeId || it.selectedSizeId || null }));
    onPopulateManualForm({ ...pendingDraft, inputChannel: pendingDraft.inputChannel || 'IA_CHAT_TEXTO', attachments: getAtts(pendingDraft), items }); setPendingDraft(null);
  };

  const handleSendText = async (customText = null) => {
    const query = (customText || inputText).trim(); if (!query || isLoading) return;
    setInputText(''); const aiMsgId = Date.now() + 1;
    setMessages((p) => [...p, { id: Date.now(), sender: 'user', text: query, timestamp: getNow() }, { id: aiMsgId, sender: 'ai', text: '', isStreaming: true, suggestedPosters: [], timestamp: getNow() }]);
    const updateAiMsg = (updater) => setMessages((p) => p.map((m) => (m.id === aiMsgId ? updater(m) : m)));
    const controller = new AbortController(); abortControllerRef.current = controller;
    const circuitBreakerTimeout = setTimeout(() => controller.abort(), 8000);
    try {
      let res;
      try {
        const history = messages.slice(-6).map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', text: `${m.text || ''}${m.sender === 'ai' && m.suggestedPosters?.length ? `\n\n[Contexto de obras:\n${m.suggestedPosters.map((p, i) => `Opción #${i + 1}: ${p.titulo || p.name || 'Póster'}${p.subtitulo ? ` - ${p.subtitulo}` : ''} [ID: ${p.id}] (Precio: Q${p.precioMinimo || 65})`).join('\n')}]` : ''}`.trim() }));
        res = await authFetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ message: query, eventId, pendingDraft: pendingDraft || null, stream: true, history }), signal: controller.signal });
      } catch (fetchErr) {
        if (fetchErr.name === 'AbortError' || !navigator.onLine) {
          const off = buildOfflineFallbackReply(query); updateAiMsg((m) => ({ ...m, isStreaming: false, text: off.text }));
          if (off.draft) setPendingDraft(off.draft);
          return;
        }
        throw fetchErr;
      } finally { clearTimeout(circuitBreakerTimeout); abortControllerRef.current = null; }

      if ((res.headers.get('content-type') || '').includes('text/event-stream')) {
        const reader = res.body.getReader(), decoder = new TextDecoder('utf-8');
        let buffer = '', accumulatedText = '', currentEvent = 'message', rafScheduled = false;
        const scheduleTokenUpdate = () => { if (!rafScheduled) { rafScheduled = true; rafIdRef.current = requestAnimationFrame(() => { rafScheduled = false; updateAiMsg((m) => ({ ...m, text: accumulatedText })); }); } };
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n'); buffer = lines.pop() || '';
          for (const rawLine of lines) {
            const line = rawLine.trim(); if (!line) { currentEvent = 'message'; continue; }
            if (line.startsWith('event:')) { currentEvent = line.replace(/^event:\s*/, '').trim(); continue; }
            if (!line.startsWith('data:')) continue;
            const dataStr = line.replace(/^data:\s*/, '').trim(); if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (currentEvent === 'token') { accumulatedText += data.text !== undefined ? data.text : data.delta || ''; scheduleTokenUpdate(); }
              else if (currentEvent === 'draft_sale') { if (data.draftSale || data) setPendingDraft(data.draftSale || data); }
              else if (currentEvent === 'done') { cancelRaf(); updateAiMsg((m) => ({ ...m, isStreaming: false, text: accumulatedText || data.fullText || m.text || 'Entendido.' })); }
              else if (currentEvent === 'error') { cancelRaf(); throw new Error(data.error || 'Error en stream SSE'); }
              else if (data && TOOL_EVENT_MAP[currentEvent]) {
                updateAiMsg((m) => ({ ...m, [TOOL_EVENT_MAP[currentEvent]]: currentEvent === 'suggested_posters' ? (Array.isArray(data) ? data : data.posters || []) : (data[currentEvent] || data.kpis || data.cashStatus || data.report || data.queue || data.stock || data) }));
              }
            } catch (parseErr) { console.warn('⚠️ [SSE Parse Error]', parseErr, dataStr); }
          }
        }
        cancelRaf(); updateAiMsg((m) => ({ ...m, isStreaming: false, text: accumulatedText || m.text }));
      } else {
        const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.error || 'Error al comunicarse con la IA');
        if (json.draftSale || json.draft) setPendingDraft(json.draftSale || json.draft);
        updateAiMsg((m) => ({ ...m, isStreaming: false, text: json.reply, suggestedPosters: json.suggestedPosters || [], eventKpis: json.eventKpis || null, cashDrawerStatus: json.cashDrawerStatus || null, sellerShiftReport: json.sellerShiftReport || null, productionQueueStatus: json.productionQueueStatus || null, inventoryStock: json.inventoryStock || null }));
      }
    } catch (err) { updateAiMsg((m) => ({ ...m, isStreaming: false, text: `⚠️ No pude responder: ${err.message}` })); }
    finally { setIsLoading(false); setProcessingNote(''); }
  };

  useEffect(() => () => { cancelRaf(); abortControllerRef.current?.abort(); if (swapDebounceRef.current) clearTimeout(swapDebounceRef.current); }, []);

  return {
    messages, setMessages, inputText, setInputText, isLoading, processingNote, pendingDraft, setPendingDraft, swappingIndex, setSwappingIndex, swapQuery, setSwapQuery, swapResults, isSearchingSwap, openSwapModal, closeSwapModal, fetchInitialSwapPosters, handleSwapSearchChange, selectSwapPoster, updateDraftItemSize, updateDraftItemQty, removeDraftItem, updateDraftPaymentMethod, discardDraft, addPosterToDraft, handleSendText, handleVoiceUpload, handleImageUpload, confirmPendingSale, transferDraftToManualForm,
  };
}
export default useAiChatStream;
