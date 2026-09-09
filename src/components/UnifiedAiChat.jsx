import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Mic,
  Square,
  Camera,
  Loader2,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronDown,
  RefreshCw,
  Trash2,
  X,
  Plus,
  Minus,
  Search,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const DEFAULT_EVENT_SIZES = [
  { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25 },
  { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', precio: 35 },
  { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: 65 },
  { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', precio: 125 },
  { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 90 cm', precio: 180 },
];

export default function UnifiedAiChat({ eventId, onSaleRegistered, onPopulateManualForm }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: '¡Hola! Soy Jarvis, tu Asistente de Ventas IA. Puedes consultarme por obras del catálogo 🎨, dictarme ventas por voz 🎙️, o subir fotos de arte y códigos 📷.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingNote, setProcessingNote] = useState('');
  const [pendingDraft, setPendingDraft] = useState(null);

  // Estados de modal para cambiar diseño
  const [swappingIndex, setSwappingIndex] = useState(null);
  const [swapQuery, setSwapQuery] = useState('');
  const [swapResults, setSwapResults] = useState([]);
  const [isSearchingSwap, setIsSearchingSwap] = useState(false);
  const swapDebounceRef = useRef(null);

  // Estados de grabación de voz
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingDraft, isRecording]);

  // Actualizar tamaño de un ítem en el borrador con recálculo dinámico de precios
  const updateDraftItemSize = (idx, newSizeId) => {
    if (!pendingDraft || !pendingDraft.items?.[idx]) return;

    setPendingDraft((prev) => {
      const items = [...prev.items];
      const it = { ...items[idx] };
      const sizes = it.availableSizes && it.availableSizes.length > 0 ? it.availableSizes : DEFAULT_EVENT_SIZES;
      const targetSize = sizes.find((s) => s.sizeId === newSizeId) || sizes[0];

      it.sizeId = targetSize.sizeId;
      it.unitPrice = Number(targetSize.precio);
      it.subtotal = Number((it.quantity * it.unitPrice).toFixed(2));
      const cleanBase = it.baseTitle || it.description.replace(/\s*\([^)]*\)\s*$/, '').trim();
      it.description = `${cleanBase} (${targetSize.nombre})`;
      items[idx] = it;

      const newTotal = items.reduce((sum, item) => sum + (item.subtotal || item.quantity * item.unitPrice), 0);
      return { ...prev, items, total: Number(newTotal.toFixed(2)) };
    });
  };

  // Ajustar cantidad de un ítem en el borrador
  const updateDraftItemQty = (idx, delta) => {
    if (!pendingDraft || !pendingDraft.items?.[idx]) return;

    setPendingDraft((prev) => {
      const items = [...prev.items];
      const it = { ...items[idx] };
      const newQty = Math.max(1, it.quantity + delta);

      it.quantity = newQty;
      it.subtotal = Number((newQty * it.unitPrice).toFixed(2));
      items[idx] = it;

      const newTotal = items.reduce((sum, item) => sum + (item.subtotal || item.quantity * item.unitPrice), 0);
      return { ...prev, items, total: Number(newTotal.toFixed(2)) };
    });
  };

  // Eliminar un ítem del borrador
  const removeDraftItem = (idx) => {
    if (!pendingDraft || !pendingDraft.items?.[idx]) return;

    setPendingDraft((prev) => {
      const items = prev.items.filter((_, i) => i !== idx);
      if (items.length === 0) return null;
      const newTotal = items.reduce((sum, item) => sum + (item.subtotal || item.quantity * item.unitPrice), 0);
      return { ...prev, items, total: Number(newTotal.toFixed(2)) };
    });
  };

  // Cambiar método de pago en el borrador
  const updateDraftPaymentMethod = (method) => {
    setPendingDraft((prev) => (prev ? { ...prev, paymentMethod: method } : null));
  };

  // Descartar borrador por completo
  const discardDraft = () => {
    setPendingDraft(null);
  };

  // Abrir selector de reemplazo de diseño
  const openSwapModal = (idx) => {
    setSwappingIndex(idx);
    setSwapQuery('');
    setSwapResults([]);
    fetchInitialSwapPosters();
  };

  const closeSwapModal = () => {
    setSwappingIndex(null);
    setSwapQuery('');
    setSwapResults([]);
  };

  const fetchInitialSwapPosters = async () => {
    try {
      setIsSearchingSwap(true);
      const res = await fetch('/api/catalog/web-posters?limit=8');
      const json = await res.json();
      if (json.success) setSwapResults(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingSwap(false);
    }
  };

  // Búsqueda interactiva en modal de cambio de diseño
  const handleSwapSearchChange = (text) => {
    setSwapQuery(text);
    if (swapDebounceRef.current) clearTimeout(swapDebounceRef.current);

    swapDebounceRef.current = setTimeout(async () => {
      setIsSearchingSwap(true);
      try {
        const res = await fetch(`/api/catalog/web-posters?q=${encodeURIComponent(text.trim())}&limit=8`);
        const json = await res.json();
        if (json.success) setSwapResults(json.data || []);
      } catch (err) {
        console.error('Error buscando reemplazo:', err);
      } finally {
        setIsSearchingSwap(false);
      }
    }, 150);
  };

  // Seleccionar póster de reemplazo
  const selectSwapPoster = (newPoster) => {
    if (swappingIndex === null || !pendingDraft) return;

    setPendingDraft((prev) => {
      const items = [...prev.items];
      const currentItem = items[swappingIndex];
      const availableSizes = newPoster.sizes && newPoster.sizes.length > 0 ? newPoster.sizes : DEFAULT_EVENT_SIZES;
      const targetSize =
        availableSizes.find((s) => s.sizeId === currentItem.sizeId) ||
        availableSizes.find((s) => s.sizeId === 'MEDIANO') ||
        availableSizes[0];

      const cleanTitle = newPoster.subtitulo ? `${newPoster.titulo} - ${newPoster.subtitulo}` : newPoster.titulo;
      const qty = currentItem.quantity || 1;
      const uPrice = Number(targetSize.precio);
      const subtotal = Number((qty * uPrice).toFixed(2));

      items[swappingIndex] = {
        productId: newPoster.id,
        webPosterId: newPoster.id,
        description: `${cleanTitle} (${targetSize.nombre})`,
        baseTitle: cleanTitle,
        category: newPoster.categoria,
        thumbUrl: newPoster.thumbUrl || newPoster.imageUrl,
        imageUrl: newPoster.imageUrl,
        quantity: qty,
        unitPrice: uPrice,
        subtotal,
        sizeId: targetSize.sizeId,
        availableSizes,
      };

      const newTotal = items.reduce((sum, item) => sum + (item.subtotal || item.quantity * item.unitPrice), 0);
      return { ...prev, items, total: Number(newTotal.toFixed(2)) };
    });

    closeSwapModal();
  };

  // Añadir un póster sugerido desde el feed de chat a un borrador
  const addPosterToDraft = (poster) => {
    const availableSizes = poster.sizes && poster.sizes.length > 0 ? poster.sizes : DEFAULT_EVENT_SIZES;
    const defaultSize = availableSizes.find((s) => s.sizeId === 'MEDIANO') || availableSizes[0];
    const cleanTitle = poster.subtitulo ? `${poster.titulo} - ${poster.subtitulo}` : poster.titulo;
    const uPrice = Number(defaultSize.precio);

    const newItem = {
      productId: poster.id,
      webPosterId: poster.id,
      description: `${cleanTitle} (${defaultSize.nombre})`,
      baseTitle: cleanTitle,
      category: poster.categoria,
      thumbUrl: poster.thumbUrl || poster.imageUrl,
      imageUrl: poster.imageUrl,
      quantity: 1,
      unitPrice: uPrice,
      subtotal: uPrice,
      sizeId: defaultSize.sizeId,
      availableSizes,
    };

    setPendingDraft((prev) => {
      if (!prev) {
        return {
          items: [newItem],
          total: uPrice,
          paymentMethod: 'EFECTIVO',
          inputChannel: 'IA_CHAT_TEXTO',
          notes: 'Venta iniciada desde catálogo sugerido',
        };
      }
      const items = [...prev.items, newItem];
      const newTotal = items.reduce((sum, item) => sum + (item.subtotal || item.quantity * item.unitPrice), 0);
      return { ...prev, items, total: Number(newTotal.toFixed(2)) };
    });
  };

  // Iniciar grabación de audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        await handleAudioSale(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accediendo al micrófono:', err);
      alert('No se pudo acceder al micrófono. Por favor verifica los permisos en tu navegador.');
    }
  };

  // Detener grabación de audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  // Enviar audio a Gemini
  const handleAudioSale = async (audioBlob) => {
    setIsLoading(true);
    setProcessingNote('Gemini analizando dictado de voz y buscando obras en catálogo...');

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: 'user',
        text: '🎙️ [Venta dictada por voz]',
        timestamp: userTime,
      },
    ]);

    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-sale.webm');
    formData.append('eventId', eventId);

    try {
      const res = await fetch('/api/ai/voice-sale', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error procesando audio con IA');
      }

      setPendingDraft(data.draftSale);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `Entendí tu dictado: "${data.draftSale.transcription || 'Venta extraída'}". Puedes cambiar tamaño o diseño en la tarjeta antes de confirmar:`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `⚠️ No pude procesar el audio: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
      setProcessingNote('');
    }
  };

  // Manejar captura de imagen (Reconocimiento visual de arte)
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setProcessingNote('Gemini Vision analizando arte contra los 233 pósters del catálogo...');

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: 'user',
        text: '📷 [Foto de obra enviada para reconocimiento visual]',
        timestamp: userTime,
      },
    ]);

    const formData = new FormData();
    formData.append('image', file, file.name);
    formData.append('eventId', eventId);

    try {
      const res = await fetch('/api/ai/recognize-artwork', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error analizando la fotografía');
      }

      setPendingDraft(data.draftSale);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `Reconocí la obra: "${data.primaryTitle || 'Póster identificado'}". Detalle: ${data.visualAnalysis || ''}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `⚠️ Error reconociendo la imagen: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
      setProcessingNote('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Enviar mensaje de texto al chat
  const handleSendText = async (customText = null) => {
    const query = (customText || inputText).trim();
    if (!query || isLoading) return;

    setInputText('');
    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), sender: 'user', text: query, timestamp: userTime },
    ]);

    setIsLoading(true);
    setProcessingNote('Consultando datos...');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          eventId,
          history: messages.slice(-6).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            text: m.text,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al comunicarse con la IA');
      }

      if (json.draftSale) {
        setPendingDraft(json.draftSale);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: json.reply,
          suggestedPosters: json.suggestedPosters || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `⚠️ No pude responder: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
      setProcessingNote('');
    }
  };

  // Confirmar y asentar la venta detectada directamente en PostgreSQL
  const confirmPendingSale = async () => {
    if (!pendingDraft || !pendingDraft.items?.length) return;

    setIsLoading(true);
    setProcessingNote('Asentando venta inmutable en PostgreSQL...');

    const grandTotal = pendingDraft.items.reduce(
      (acc, it) => acc + (it.subtotal || it.quantity * it.unitPrice),
      0
    );

    const salePayload = {
      eventId,
      items: pendingDraft.items.map((i) => ({
        productId: i.productId || null,
        description: i.description,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
      payments: [
        {
          method: pendingDraft.paymentMethod || 'EFECTIVO',
          amount: grandTotal,
          reference: pendingDraft.notes || null,
        },
      ],
      discount: Number(pendingDraft.discount || 0),
      notes: pendingDraft.notes || null,
      inputChannel: pendingDraft.inputChannel || 'IA_CHAT_TEXTO',
      attachments: pendingDraft.audioUrl
        ? [{ fileUrl: pendingDraft.audioUrl, fileType: 'AUDIO_VOZ', transcription: pendingDraft.transcription }]
        : pendingDraft.imageUrl
        ? [{ fileUrl: pendingDraft.imageUrl, fileType: 'FOTO_ARTE' }]
        : [],
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error registrando la venta');
      }

      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#10B981', '#3B82F6'],
        });
      } catch (e) {}

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          sender: 'ai',
          text: `🎉 ¡Venta ${json.data.saleNumber} asentada con éxito por Q ${grandTotal.toFixed(2)} en PostgreSQL!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      setPendingDraft(null);
      if (onSaleRegistered) onSaleRegistered(json.data);
    } catch (err) {
      console.error(err);
      alert(`Error confirmando venta: ${err.message}`);
    } finally {
      setIsLoading(false);
      setProcessingNote('');
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="glass-card rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col h-[460px] sm:h-[490px] relative">
      {/* Cabecera del Chat */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black text-xs shadow-md">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 leading-none">
              Jarvis de Ventas IA
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                Gemini 3.8
              </span>
            </h3>
            <span className="text-[10px] text-slate-400">Dictado por voz, fotos y catálogo de 233 pósters</span>
          </div>
        </div>

        {/* Píldoras Rápidas de Consulta */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSendText('¿Cuánto llevamos vendido hoy?')}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
          >
            💰 Ventas Hoy
          </button>
          <button
            type="button"
            onClick={() => handleSendText('¿Cuáles son los pósters más vendidos?')}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
          >
            ⭐ Top Obras
          </button>
        </div>
      </div>

      {/* Historial de Mensajes con Scroll */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 no-scrollbar text-xs">
        {messages.map((m) => (
          <div key={m.id} className="space-y-2">
            <div className={`flex items-start gap-2 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.sender === 'ai' && (
                <div className="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/10'
                    : 'bg-slate-900/90 text-slate-200 border border-slate-800 shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>

                {/* Tarjetas de Sugerencias Visuales de Catálogo */}
                {m.suggestedPosters && m.suggestedPosters.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                      🎨 Obras encontradas en catálogo ({m.suggestedPosters.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {m.suggestedPosters.map((sp) => (
                        <div
                          key={sp.id}
                          className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/90 border border-slate-800 hover:border-amber-500/50 transition-all shadow-sm"
                        >
                          <img
                            src={sp.thumbUrl || sp.imageUrl}
                            alt={sp.titulo}
                            className="w-10 h-14 object-cover rounded-md border border-slate-700/80 shrink-0 bg-slate-900 shadow"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-xs text-slate-100 block truncate">{sp.titulo}</span>
                            <span className="text-[10px] text-slate-400 block truncate">{sp.subtitulo || sp.categoria}</span>
                            <span className="text-[11px] text-emerald-400 font-bold block mt-0.5">
                              Desde Q{sp.precioMinimo}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => addPosterToDraft(sp)}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md text-[10px] font-black shrink-0 shadow cursor-pointer transition-transform active:scale-95"
                          >
                            + Vender
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className={`text-[9px] mt-1 text-right ${
                    m.sender === 'user' ? 'text-slate-900/70 font-bold' : 'text-slate-500'
                  }`}
                >
                  {m.timestamp}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Tarjeta de Borrador Detectado Human-in-the-Loop */}
        {pendingDraft && (
          <div className="p-3 rounded-xl bg-slate-900 border-2 border-amber-500/80 shadow-2xl space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5" /> Venta Detectada por IA
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">
                  Canal: <strong className="text-slate-200">{pendingDraft.inputChannel}</strong>
                </span>
                <button
                  type="button"
                  onClick={discardDraft}
                  className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                  title="Descartar borrador"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
              {pendingDraft.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2.5 p-2 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px]"
                >
                  {/* Miniatura WebP con borde */}
                  <img
                    src={it.thumbUrl || it.imageUrl}
                    alt=""
                    className="w-10 h-13 object-cover rounded-md border border-slate-700 shrink-0 bg-slate-900"
                  />

                  {/* Detalle y selector de tamaño */}
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-slate-200 block truncate">
                      {it.baseTitle || it.description}
                    </span>
                    <span className="text-[9px] text-amber-400 uppercase font-semibold block">
                      {it.category || 'ARTE'}
                    </span>

                    {/* Selector de tamaño interactivo */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <label className="text-[10px] text-slate-400 font-medium">Tamaño:</label>
                      <select
                        value={it.sizeId || 'MEDIANO'}
                        onChange={(e) => updateDraftItemSize(idx, e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-amber-300 font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                      >
                        {(it.availableSizes && it.availableSizes.length > 0
                          ? it.availableSizes
                          : DEFAULT_EVENT_SIZES
                        ).map((s) => (
                          <option key={s.sizeId} value={s.sizeId}>
                            {s.nombre} (Q{s.precio})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Botón Cambiar Diseño */}
                    <button
                      type="button"
                      onClick={() => openSwapModal(idx)}
                      className="text-[10px] text-slate-400 hover:text-amber-400 flex items-center gap-1 underline transition-colors cursor-pointer mt-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Cambiar diseño
                    </button>
                  </div>

                  {/* Cantidad y Subtotal */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5">
                      <button
                        type="button"
                        onClick={() => updateDraftItemQty(idx, -1)}
                        className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className="font-bold text-xs text-slate-200 px-1">{it.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateDraftItemQty(idx, 1)}
                        className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    <span className="font-black text-xs text-emerald-400">
                      Q{(it.quantity * it.unitPrice).toFixed(2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeDraftItem(idx)}
                      className="text-slate-500 hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                      title="Eliminar este póster"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Selector de Método de Pago y Total */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => updateDraftPaymentMethod(m)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                        pendingDraft.paymentMethod === m
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m === 'EFECTIVO' ? '💵 Efectivo' : m === 'TARJETA' ? '💳 Tarjeta' : '📱 Transfer'}
                    </button>
                  ))}
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 mr-1">Total:</span>
                  <strong className="text-emerald-400 text-sm font-black">
                    Q {pendingDraft.total?.toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={discardDraft}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-950/40 hover:text-red-400 text-slate-400 text-[11px] font-semibold border border-slate-700 transition-colors cursor-pointer"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onPopulateManualForm) onPopulateManualForm(pendingDraft);
                      setPendingDraft(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-slate-700 transition-colors cursor-pointer"
                  >
                    Modificar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={confirmPendingSale}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black flex items-center gap-1 shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar Venta</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Indicador de carga */}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs italic py-1">
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>{processingNote || 'Gemini 3.8 procesando...'}</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Modal / Overlay Flotante para Cambiar Diseño */}
      {swappingIndex !== null && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-30 p-3 flex flex-col animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Seleccionar Póster de Reemplazo
            </span>
            <button
              type="button"
              onClick={closeSwapModal}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative my-2">
            <Search className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Escribe el nombre o personaje... (ej. Goku, Taylor, Spider-Man)"
              value={swapQuery}
              onChange={(e) => handleSwapSearchChange(e.target.value)}
              autoFocus
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 no-scrollbar pr-1">
            {isSearchingSwap ? (
              <div className="flex items-center justify-center p-6 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-amber-400" />
                Buscando en catálogo oficial...
              </div>
            ) : swapResults.length === 0 ? (
              <div className="text-center p-6 text-xs text-slate-400">
                No se encontraron obras coincidentes. Escribe otras palabras clave.
              </div>
            ) : (
              swapResults.map((p) => (
                <div
                  key={p.id}
                  onClick={() => selectSwapPoster(p)}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={p.thumbUrl || p.imageUrl}
                      alt=""
                      className="w-8 h-11 object-cover rounded border border-slate-700 shrink-0 bg-slate-950"
                    />
                    <div className="truncate">
                      <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block">
                        {p.categoria}
                      </span>
                      <span className="font-bold text-xs text-slate-100 block truncate">{p.titulo}</span>
                      <span className="text-[10px] text-slate-400 block truncate">{p.subtitulo || ''}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-emerald-400 block">Q{p.precioMinimo}</span>
                    <span className="text-[9px] text-amber-400 font-semibold">Seleccionar</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Barra de Entrada Unificada con Micrófono y Cámara Integrados */}
      <div className="p-2.5 bg-slate-900/95 border-t border-slate-800 shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleImageUpload}
          className="hidden"
        />

        {isRecording ? (
          <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-red-950/40 border border-red-500/40 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-xs font-bold text-red-400">
                Dictando venta: {formatTime(recordingSeconds)}
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                (Habla claro: "2 medianos de Batman a 65 en efectivo")
              </span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Finalizar y Enviar</span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendText();
            }}
            className="flex items-center gap-1.5"
          >
            <button
              type="button"
              onClick={startRecording}
              disabled={isLoading}
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 flex items-center justify-center transition-all shadow-md shadow-amber-500/20 disabled:opacity-40 cursor-pointer shrink-0"
              title="Dictar venta por voz"
            >
              <Mic className="w-4 h-4 font-bold" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-amber-400 flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shrink-0"
              title="Tomar foto del arte del póster"
            >
              <Camera className="w-4 h-4" />
            </button>

            <input
              type="text"
              placeholder="Dicta 🎙️, foto 📷, escribe una venta o consulta..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-medium"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center transition-all disabled:opacity-30 cursor-pointer shrink-0 font-bold"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
