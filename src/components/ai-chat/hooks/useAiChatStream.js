import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import confetti from 'canvas-confetti';
import { DEFAULT_EVENT_SIZES, buildOfflineFallbackReply } from '../chatConstants';
import { searchPostersWithFallback } from '../../../services/catalogCacheService.js';

const TOOL_EVENT_MAP = { suggested_posters: 'suggestedPosters', event_kpis: 'eventKpis', cash_drawer_status: 'cashDrawerStatus', seller_shift_report: 'sellerShiftReport', production_queue_status: 'productionQueueStatus', inventory_stock: 'inventoryStock' };
const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
export function useAiChatStream({ eventId, onSaleRegistered, onPopulateManualForm } = {}) {
  const { authFetch, user } = useAuth(), getGreeting = (u) => { const f = u?.fullName?.trim().split(' ')[0] || u?.name; return f ? `¡Hola ${f}! Estoy listo para que hagamos muchas ventas, ¿con qué comenzamos?` : '¡Hola! Soy STAND IA y estoy listo para que hagamos muchas ventas, ¿con qué comenzamos?'; };
  const [messages, setMessages] = useState(() => [{ id: genId(), sender: 'ai', text: getGreeting(user), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
  useEffect(() => { if (user?.fullName) { const g = getGreeting(user); setMessages((p) => (p.length === 1 && p[0].sender === 'ai' && p[0].text.startsWith('¡Hola') ? [{ ...p[0], text: g }] : p)); } }, [user?.fullName]);

  const [inputText, setInputText] = useState(''), [isLoading, setIsLoading] = useState(false), [processingNote, setProcessingNote] = useState(''), [pendingDraft, setPendingDraft] = useState(null), [swappingIndex, setSwappingIndex] = useState(null), [swapQuery, setSwapQuery] = useState(''), [swapResults, setSwapResults] = useState([]), [isSearchingSwap, setIsSearchingSwap] = useState(false), [aiError, setAiError] = useState(null), clearAiError = () => setAiError(null);
  const pendingDraftRef = useRef(pendingDraft); pendingDraftRef.current = pendingDraft;
  const abortControllerRef = useRef(null), rafIdRef = useRef(null), swapDebounceRef = useRef(null);
  const getNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), pushAiMsg = (text) => setMessages((p) => [...p, { id: genId(), sender: 'ai', text, timestamp: getNow() }]);
  const recalculateTotal = (items) => Number(items.reduce((s, i) => s + (i.subtotal || i.quantity * i.unitPrice), 0).toFixed(2)), cancelRaf = () => { if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; } };
  const getAtts = (p) => Array.isArray(p.attachments) && p.attachments.length ? p.attachments : p.audioUrl ? [{ fileUrl: p.audioUrl, fileType: 'AUDIO_VOZ', transcription: p.transcription || null }] : p.imageUrl ? [{ fileUrl: p.imageUrl, fileType: p.inputChannel === 'IA_IMAGEN_QR' ? 'FOTO_QR' : 'FOTO_ARTE' }] : [];

  const updateDraftItemSize = (idx, newSizeId) => pendingDraftRef.current?.items?.[idx] && setPendingDraft((prev) => {
    const cur = prev || pendingDraftRef.current, items = [...cur.items], it = items[idx], sizes = Array.isArray(it.availableSizes) && it.availableSizes.length > 0 ? it.availableSizes : DEFAULT_EVENT_SIZES, target = sizes.find((s) => s.sizeId === newSizeId) || sizes[0];
    items[idx] = { ...it, sizeId: target.sizeId, unitPrice: Number(target.precio), subtotal: Number((it.quantity * Number(target.precio)).toFixed(2)), description: `${it.baseTitle || it.description.replace(/\s*\([^)]*\)\s*$/, '').trim()} (${target.nombre})`, availableSizes: sizes };
    const next = { ...cur, items, total: recalculateTotal(items) }; pendingDraftRef.current = next; return next;
  }), updateDraftItemQty = (idx, delta) => pendingDraftRef.current?.items?.[idx] && setPendingDraft((prev) => {
    const cur = prev || pendingDraftRef.current, items = [...cur.items], qty = Math.max(1, items[idx].quantity + delta);
    items[idx] = { ...items[idx], quantity: qty, subtotal: Number((qty * items[idx].unitPrice).toFixed(2)) };
    const next = { ...cur, items, total: recalculateTotal(items) }; pendingDraftRef.current = next; return next;
  }), removeDraftItem = (idx) => pendingDraftRef.current?.items?.[idx] && setPendingDraft((p) => { const cur = p || pendingDraftRef.current, items = cur.items.filter((_, i) => i !== idx), next = items.length ? { ...cur, items, total: recalculateTotal(items) } : null; pendingDraftRef.current = next; return next; });
  const updateDraftPaymentMethod = (method) => setPendingDraft((p) => { const cur = p || pendingDraftRef.current, next = cur ? { ...cur, paymentMethod: method } : null; pendingDraftRef.current = next; return next; }), discardDraft = () => { pendingDraftRef.current = null; setPendingDraft(null); pushAiMsg('🗑️ Borrador descartado. ¿Qué otra venta u obra preparamos?'); };

  const addPosterToDraft = (poster) => {
    const sizes = poster.sizes?.length ? poster.sizes : DEFAULT_EVENT_SIZES, def = sizes.find((s) => s.sizeId === 'MEDIANO') || sizes[0], title = poster.subtitulo ? `${poster.titulo} - ${poster.subtitulo}` : poster.titulo, uPrice = Number(def.precio);
    const item = { productId: poster.id, webPosterId: poster.id, description: `${title} (${def.nombre})`, baseTitle: title, category: poster.categoria, thumbUrl: poster.thumbUrl || poster.imageUrl, imageUrl: poster.imageUrl, quantity: 1, unitPrice: uPrice, subtotal: uPrice, sizeId: def.sizeId, availableSizes: sizes };
    setPendingDraft((p) => { const cur = p || pendingDraftRef.current, next = cur ? { ...cur, items: [...cur.items, item], total: recalculateTotal([...cur.items, item]) } : { items: [item], total: uPrice, paymentMethod: 'EFECTIVO', inputChannel: 'IA_CHAT_TEXTO', notes: 'Venta iniciada desde catálogo sugerido' }; pendingDraftRef.current = next; return next; });
  };

  const fetchInitialSwapPosters = async () => { setIsSearchingSwap(true); try { const data = await searchPostersWithFallback(async (sig) => (await (await authFetch('/api/catalog/web-posters?limit=30', { signal: sig })).json())?.data || [], '', 30); setSwapResults(data || []); } catch (e) { console.error(e); } finally { setIsSearchingSwap(false); } }, openSwapModal = (idx) => { setSwappingIndex(idx); setSwapQuery(''); setSwapResults([]); fetchInitialSwapPosters(); }, closeSwapModal = () => { setSwappingIndex(null); setSwapQuery(''); setSwapResults([]); };
  const handleSwapSearchChange = (text) => { setSwapQuery(text); if (swapDebounceRef.current) clearTimeout(swapDebounceRef.current); swapDebounceRef.current = setTimeout(async () => { setIsSearchingSwap(true); try { const data = await searchPostersWithFallback(async (sig) => (await (await authFetch(`/api/catalog/web-posters?q=${encodeURIComponent(text.trim())}&limit=30`, { signal: sig })).json())?.data || [], text, 30); setSwapResults(data || []); } catch (err) { console.error(err); } finally { setIsSearchingSwap(false); } }, 150); };
  const selectSwapPoster = (newPoster) => {
    if (swappingIndex === null || !pendingDraftRef.current) return;
    const cur = pendingDraftRef.current, items = [...cur.items], old = items[swappingIndex], sizes = newPoster.sizes?.length ? newPoster.sizes : DEFAULT_EVENT_SIZES, target = sizes.find((s) => s.sizeId === old.sizeId) || sizes.find((s) => s.sizeId === 'MEDIANO') || sizes[0], title = newPoster.subtitulo ? `${newPoster.titulo} - ${newPoster.subtitulo}` : newPoster.titulo, qty = old.quantity || 1, uPrice = Number(target.precio);
    items[swappingIndex] = { productId: newPoster.id, webPosterId: newPoster.id, description: `${title} (${target.nombre})`, baseTitle: title, category: newPoster.categoria, thumbUrl: newPoster.thumbUrl || newPoster.imageUrl, imageUrl: newPoster.imageUrl, quantity: qty, unitPrice: uPrice, subtotal: Number((qty * uPrice).toFixed(2)), sizeId: target.sizeId, availableSizes: sizes };
    const next = { ...cur, items, total: recalculateTotal(items) }; pendingDraftRef.current = next; setPendingDraft(next); closeSwapModal();
  };

  const uploadMedia = async (url, form, userText, note, onDone) => {
    setIsLoading(true); setProcessingNote(note); setAiError(null); setMessages((p) => [...p, { id: genId(), sender: 'user', text: userText, timestamp: getNow() }]);
    try {
      const res = await authFetch(url, { method: 'POST', body: form }), data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error procesando');
      pendingDraftRef.current = data.draftSale; setPendingDraft(data.draftSale); onDone(data);
    } catch (err) {
      const isQuota = /429|cuota|quota|resource_exhausted/i.test(err?.message), isNet = /fetch|network|conexi[oó]n|offline|failed/i.test(err?.message), friendlyMsg = isQuota ? 'Límite de cuota de IA alcanzado. Continúa en modo manual.' : isNet ? 'Problema de conexión con el servicio de IA.' : err?.message?.replace(/^.*AI_MEDIA_SERVICE_FAILED:\s*/, '').trim() || 'No fue posible procesar el archivo.';
      setAiError({ title: url.includes('voice') ? 'Fallo en dictado de voz' : 'Fallo en foto/visión', message: friendlyMsg, channel: url.includes('voice') ? 'IA_VOZ' : 'IA_FOTO_ARTE' }); pushAiMsg(`⚠️ ${friendlyMsg}`);
    } finally { setIsLoading(false); setProcessingNote(''); }
  };

  const handleVoiceUpload = (audioBlob) => {
    const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('aac') ? 'aac' : 'webm', form = new FormData();
    form.append('audio', audioBlob, `voice-sale.${ext}`); form.append('eventId', eventId);
    uploadMedia('/api/ai/voice-sale', form, '🎙️ [Venta dictada por voz]', 'Gemini analizando dictado de voz...', (d) => pushAiMsg(`Entendí tu dictado: "${d.draftSale?.transcription || 'Venta extraída'}". Puedes cambiar tamaño o diseño en la tarjeta antes de confirmar:`));
  }, handleImageUpload = (e) => {
    const file = e?.target?.files?.[0]; if (!file) return;
    const form = new FormData(); form.append('image', file, file.name); form.append('eventId', eventId);
    uploadMedia('/api/ai/recognize-artwork', form, '📷 [Foto de obra enviada]', 'Gemini Vision analizando arte contra catálogo...', (d) => pushAiMsg(`Reconocí la obra: "${d.primaryTitle || 'Póster identificado'}". Detalle: ${d.visualAnalysis || ''}`));
    if (e.target) e.target.value = '';
  };
  const confirmPendingSale = async () => {
    const draft = pendingDraftRef.current; if (!draft?.items?.length) return;
    setIsLoading(true); setProcessingNote('Asentando venta inmutable en PostgreSQL...');
    const grandTotal = recalculateTotal(draft.items), discount = Number(draft.discount || 0), netTotal = Number(Math.max(0, grandTotal - discount).toFixed(2)), isUuid = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
    const salePayload = { eventId, items: draft.items.map((i) => ({ productId: isUuid(i.productId) ? i.productId : null, description: i.description, quantity: i.quantity, unitPrice: Number(i.unitPrice) })), payments: [{ method: draft.paymentMethod || 'EFECTIVO', amount: netTotal, reference: draft.notes || null }], discount, notes: draft.notes || null, inputChannel: draft.inputChannel || 'IA_CHAT_TEXTO', attachments: getAtts(draft) };
    try {
      const res = await authFetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(salePayload) }), json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error registrando la venta');
      try { confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 }, colors: ['#F59E0B', '#10B981', '#3B82F6'] }); } catch (_) {}
      pushAiMsg(`🎉 ¡Venta ${json.data.saleNumber} asentada con éxito por Q ${netTotal.toFixed(2)} en PostgreSQL!`);
      pendingDraftRef.current = null; setPendingDraft(null); if (onSaleRegistered) onSaleRegistered(json.data);
    } catch (err) { console.error(err); alert(`Error confirmando venta: ${err.message}`); } finally { setIsLoading(false); setProcessingNote(''); }
  };
  const transferDraftToManualForm = () => {
    const draft = pendingDraftRef.current; if (!onPopulateManualForm || !draft) return;
    const items = (draft.items || []).map((it) => ({ ...it, selectedSizeId: it.selectedSizeId || it.sizeId || null, sizeId: it.sizeId || it.selectedSizeId || null }));
    onPopulateManualForm({ ...draft, inputChannel: draft.inputChannel || 'IA_CHAT_TEXTO', attachments: getAtts(draft), items });
    pendingDraftRef.current = null; setPendingDraft(null);
  };

  const handleSendText = async (customText = null) => {
    const query = (customText || inputText).trim(); if (!query || isLoading) return;
    setInputText(''); setAiError(null); const userMsgId = genId(), aiMsgId = genId();
    setMessages((p) => [...p, { id: userMsgId, sender: 'user', text: query, timestamp: getNow() }, { id: aiMsgId, sender: 'ai', text: '', isStreaming: true, suggestedPosters: [], timestamp: getNow() }]);
    const updateAiMsg = (updater) => setMessages((p) => p.map((m) => (m.sender === 'ai' && m.id === aiMsgId ? updater(m) : m)));
    const controller = new AbortController(); abortControllerRef.current = controller; const circuitBreakerTimeout = setTimeout(() => controller.abort(), 25000);
    try {
      let res;
      try {
        const history = messages.slice(-20).map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: `${m.text || ''}${m.sender === 'ai' && m.suggestedPosters?.length ? `\n\n[Contexto de obras:\n${m.suggestedPosters.map((p, i) => `Opción #${i + 1}: ${p.titulo || p.name || 'Póster'}${p.subtitulo ? ` - ${p.subtitulo}` : ''} [ID: ${p.id}] (Precio: Q${p.precioMinimo || 65})`).join('\n')}]` : ''}`.trim() }], text: m.text || '' }));
        res = await authFetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ message: query, eventId, pendingDraft: pendingDraftRef.current || null, stream: true, history, sellerName: user?.fullName || 'Vendedor' }), signal: controller.signal });
      } catch (fetchErr) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const off = buildOfflineFallbackReply(query); updateAiMsg((m) => ({ ...m, isStreaming: false, text: off.text }));
          if (off.draft) { pendingDraftRef.current = off.draft; setPendingDraft(off.draft); } return;
        }
        updateAiMsg((m) => ({ ...m, isStreaming: false, text: fetchErr.name === 'AbortError' ? '⚠️ La consulta a Gemini tardó más de 25 segundos. Por favor intenta nuevamente.' : `⚠️ Error consultando IA: ${fetchErr.message}` })); return;
      } finally { clearTimeout(circuitBreakerTimeout); abortControllerRef.current = null; }

      if ((res.headers.get('content-type') || '').includes('text/event-stream')) {
        const reader = res.body.getReader(), decoder = new TextDecoder('utf-8');
        let buffer = '', accumulatedText = '', rafScheduled = false;
        const scheduleTokenUpdate = () => { if (!rafScheduled) { rafScheduled = true; rafIdRef.current = requestAnimationFrame(() => { rafScheduled = false; updateAiMsg((m) => ({ ...m, text: accumulatedText })); }); } };
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
          const blocks = buffer.split('\n\n'); buffer = blocks.pop() || '';
          for (const block of blocks) {
            const rawBlock = block.trim(); if (!rawBlock) continue;
            let ev = 'message', dataLines = [];
            for (const rL of rawBlock.split('\n')) { const l = rL.trim(); if (l.startsWith('event:')) ev = l.replace(/^event:\s*/, '').trim(); else if (l.startsWith('data:')) dataLines.push(l.replace(/^data:\s*/, '')); }
            if (!dataLines.length) continue;
            try {
              const data = JSON.parse(dataLines.join('\n'));
              if (ev === 'token') { accumulatedText += data.text !== undefined ? data.text : data.delta || ''; scheduleTokenUpdate(); }
              else if (ev === 'draft_sale') { const d = data.draftSale || data; if (d) { pendingDraftRef.current = d; setPendingDraft(d); } }
              else if (ev === 'done') { cancelRaf(); updateAiMsg((m) => ({ ...m, isStreaming: false, text: accumulatedText || data.fullText || m.text || (pendingDraftRef.current ? '¡Listo! Te dejé preparado el borrador en pantalla.' : '¡Con gusto te asesoro con cualquier duda o venta en el stand!') })); }
              else if (ev === 'error') { cancelRaf(); throw new Error(data.error || 'Error en stream SSE'); }
              else if (data && TOOL_EVENT_MAP[ev]) updateAiMsg((m) => ({ ...m, [TOOL_EVENT_MAP[ev]]: ev === 'suggested_posters' ? (Array.isArray(data) ? data : data.posters || []) : (data[ev] || data.kpis || data.cashStatus || data.report || data.queue || data.stock || data) }));
            } catch (parseErr) { console.warn('⚠️ [SSE Parse Error]', parseErr); }
          }
        }
        cancelRaf(); updateAiMsg((m) => ({ ...m, isStreaming: false, text: accumulatedText || m.text || (pendingDraftRef.current ? '¡Listo! Te dejé preparado el borrador en pantalla.' : '¡Con gusto te asesoro con cualquier duda o venta en el stand!') }));
      } else {
        const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.error || 'Error al comunicarse con la IA');
        const d = json.draftSale || json.draft; if (d) { pendingDraftRef.current = d; setPendingDraft(d); }
        updateAiMsg((m) => ({ ...m, isStreaming: false, text: json.reply, suggestedPosters: json.suggestedPosters || [], eventKpis: json.eventKpis || null, cashDrawerStatus: json.cashDrawerStatus || null, sellerShiftReport: json.sellerShiftReport || null, productionQueueStatus: json.productionQueueStatus || null, inventoryStock: json.inventoryStock || null }));
      }
    } catch (err) { updateAiMsg((m) => ({ ...m, isStreaming: false, text: `⚠️ No pude responder: ${err.message}` })); } finally { setIsLoading(false); setProcessingNote(''); }
  };
  useEffect(() => () => { cancelRaf(); abortControllerRef.current?.abort(); if (swapDebounceRef.current) clearTimeout(swapDebounceRef.current); }, []);

  return { messages, setMessages, inputText, setInputText, isLoading, processingNote, pendingDraft, setPendingDraft, swappingIndex, setSwappingIndex, swapQuery, setSwapQuery, swapResults, isSearchingSwap, openSwapModal, closeSwapModal, fetchInitialSwapPosters, handleSwapSearchChange, selectSwapPoster, updateDraftItemSize, updateDraftItemQty, removeDraftItem, updateDraftPaymentMethod, discardDraft, addPosterToDraft, handleSendText, handleVoiceUpload, handleImageUpload, confirmPendingSale, transferDraftToManualForm, aiError, clearAiError };
}
export default useAiChatStream;
