import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Send,
  Mic,
  Square,
  Camera,
  Loader2,
  CheckCircle2,
  ShoppingBag,
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

// ── R4: Offline Heuristic Engine ─────────────────────────────────────────────
// Parses a free-text sales query into a draft sale without any network call.
// Used as fallback when the Gemini API is unreachable (circuit breaker fires).
const SIZE_PRICE_MAP = {
  MINI: 25, PEQUENO: 35, MEDIANO: 65, GRANDE: 125, GIGANTE: 180,
};
const SIZE_ALIASES = [
  { re: /\b(gigante|extra\s*grande|24[xX]36|60[xX]90)\b/i, id: 'GIGANTE' },
  { re: /\b(grande|18[xX]24|45[xX]60)\b/i,                  id: 'GRANDE' },
  { re: /\b(mediano?|medio|12[xX]18|30[xX]45)\b/i,           id: 'MEDIANO' },
  { re: /\b(peque[ñn]o|chico|8[xX]10|21[xX]27)\b/i,         id: 'PEQUENO' },
  { re: /\b(mini|5[xX]7|14[xX]21)\b/i,                       id: 'MINI' },
];
const PAYMENT_ALIASES = [
  { re: /\b(tarjeta|card)\b/i, method: 'TARJETA' },
  { re: /\b(transfer|transf)\b/i, method: 'TRANSFERENCIA' },
];

function buildOfflineFallbackReply(query) {
  const q = query.trim();

  // Extract quantity (e.g. "2 spiderman", "tres batman")
  const qtyWords = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
  let quantity = 1;
  const qtyNumMatch = q.match(/\b([2-9]|10)\b/);
  if (qtyNumMatch) quantity = parseInt(qtyNumMatch[1], 10);
  else {
    for (const [word, val] of Object.entries(qtyWords)) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(q)) { quantity = val; break; }
    }
  }

  // Extract size
  let sizeId = 'MEDIANO';
  for (const { re, id } of SIZE_ALIASES) {
    if (re.test(q)) { sizeId = id; break; }
  }
  const price = SIZE_PRICE_MAP[sizeId] || 65;
  const sizeObj = DEFAULT_EVENT_SIZES.find((s) => s.sizeId === sizeId) || DEFAULT_EVENT_SIZES[2];

  // Extract payment method
  let paymentMethod = 'EFECTIVO';
  for (const { re, method } of PAYMENT_ALIASES) {
    if (re.test(q)) { paymentMethod = method; break; }
  }

  // Extract poster name (everything not a size/number/payment word)
  const posterName = q
    .replace(/\b(mini|pequeño|mediano|grande|gigante|extra\s*grande|18x24|12x18|24x36|tarjeta|transfer|efectivo|uno|dos|tres|cuatro|cinco|[0-9]+)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || 'Póster';

  const subtotal = quantity * price;
  const draft = {
    items: [{
      description: `${posterName} (${sizeObj.nombre})`,
      quantity,
      unitPrice: price,
      subtotal,
      sizeId,
      availableSizes: DEFAULT_EVENT_SIZES,
    }],
    total: subtotal,
    paymentMethod,
    inputChannel: 'IA_CHAT_TEXTO',
    notes: '[Modo offline — verificar obra antes de confirmar]',
  };

  return {
    text: `📡 **Sin conexión a Gemini.** Generé un borrador aproximado con motor local:\n"${posterName} × ${quantity} (${sizeObj.nombre}) = Q${subtotal}"\n⚠️ Por favor verifica el nombre y precio antes de confirmar.`,
    draft,
  };
}
// ── End Offline Engine ────────────────────────────────────────────────────────



export default function UnifiedAiChat({ eventId, onSaleRegistered, onPopulateManualForm }) {
  const { authFetch } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: '¡Hola! Soy STAND IA y estoy listo para registrar ventas y dar reportes, ¿con qué comenzamos?',
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
  const [vadActive, setVadActive] = useState(false); // Shows "Silence detected…" indicator
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioContextRef = useRef(null);   // R1: VAD AudioContext
  const vadTimerRef = useRef(null);       // R1: VAD silence timeout
  const abortControllerRef = useRef(null); // R4: Circuit Breaker AbortController

  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);


  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, pendingDraft, isRecording]);

  // Limpieza estricta de pistas de audio, VAD context y temporizador al desmontar componente
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (_) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      // R1: Close VAD AudioContext
      if (vadTimerRef.current) {
        clearTimeout(vadTimerRef.current);
        vadTimerRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      // R4: Cancel in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);


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
      const res = await authFetch('/api/catalog/web-posters?limit=8');
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
        const res = await authFetch(`/api/catalog/web-posters?q=${encodeURIComponent(text.trim())}&limit=8`);
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

  // Detección y negociación dinámica de códec para compatibilidad cross-browser (Chrome, Firefox, Safari/iOS)
  const getSupportedAudioMimeType = () => {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      return '';
    }
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return '';
  };

  // Iniciar grabación de audio con VAD (Voice Activity Detection) + supresión de ruido + negociación de códec
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const selectedMime = getSupportedAudioMimeType();
      const recorderOptions = selectedMime ? { mimeType: selectedMime } : undefined;
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const actualMime = mediaRecorder.mimeType || selectedMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        // Close VAD context
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        await handleAudioSale(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setVadActive(false);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // ── R1: Voice Activity Detection (VAD) via Web Audio API ──────────────
      // Silence threshold: -50 dBFS, silence window: 1500ms
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.8;
          source.connect(analyser);
          const buffer = new Float32Array(analyser.fftSize);

          const SILENCE_THRESHOLD = 0.003; // ~-50 dBFS
          const SILENCE_WINDOW_MS = 1500;  // 1.5 seconds of continuous silence
          let lastSoundAt = Date.now();

          const vadPoll = setInterval(() => {
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
              clearInterval(vadPoll);
              return;
            }
            analyser.getFloatTimeDomainData(buffer);
            // Compute RMS amplitude
            let rms = 0;
            for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
            rms = Math.sqrt(rms / buffer.length);

            if (rms > SILENCE_THRESHOLD) {
              lastSoundAt = Date.now();
              setVadActive(false);
            } else if (Date.now() - lastSoundAt > SILENCE_WINDOW_MS) {
              // Silence detected for 1.5s → auto-stop recording
              clearInterval(vadPoll);
              setVadActive(false);
              if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
                if (recordingTimerRef.current) {
                  clearInterval(recordingTimerRef.current);
                  recordingTimerRef.current = null;
                }
              }
            } else {
              // In the silence window — show indicator after 500ms
              if (Date.now() - lastSoundAt > 500) setVadActive(true);
            }
          }, 100);
        }
      } catch (vadErr) {
        // VAD is non-critical — recording still works without it
        console.warn('[VAD] AudioContext not available, auto-stop disabled:', vadErr.message);
      }
      // ── End VAD ───────────────────────────────────────────────────────────
    } catch (err) {
      console.error('Error accediendo al micrófono:', err);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      alert('No se pudo acceder al micrófono o tu navegador no soporta grabación de audio. Por favor verifica los permisos.');
    }
  };


  // Detener grabación de audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // Enviar audio a Gemini con extensión dinámica
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

    const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('aac') ? 'aac' : 'webm';
    const formData = new FormData();
    formData.append('audio', audioBlob, `voice-sale.${ext}`);
    formData.append('eventId', eventId);

    try {
      const res = await authFetch('/api/ai/voice-sale', {
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
      const res = await authFetch('/api/ai/recognize-artwork', {
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

  // Enviar mensaje de texto al chat con soporte para streaming SSE y renderizado progresivo
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

    const aiMsgId = Date.now() + 1;
    const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Agregar mensaje inicial vacío del asistente con isStreaming: true
    setMessages((prev) => [
      ...prev,
      {
        id: aiMsgId,
        sender: 'ai',
        text: '',
        isStreaming: true,
        suggestedPosters: [],
        timestamp: aiTime,
      },
    ]);

    try {
      // ── R4: Circuit Breaker — AbortController with 8s timeout ─────────────
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const circuitBreakerTimeout = setTimeout(() => controller.abort(), 8000);

      let res;
      try {
        res = await authFetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            message: query,
            eventId,
            pendingDraft: pendingDraft || null,
            stream: true,
            history: messages.slice(-6).map((m) => ({
              role: m.sender === 'user' ? 'user' : 'model',
              text: m.text,
            })),
          }),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(circuitBreakerTimeout);
        abortControllerRef.current = null;

        // ── Offline Heuristic Engine ─────────────────────────────────────────
        // Triggered when network is down or timeout fires. Parses the user
        // query locally to generate a sale draft without Gemini.
        const isOfflineOrTimeout = fetchErr.name === 'AbortError' || !navigator.onLine;
        if (isOfflineOrTimeout) {
          const offlineReply = buildOfflineFallbackReply(query);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    isStreaming: false,
                    text: offlineReply.text,
                  }
                : m
            )
          );
          if (offlineReply.draft) {
            setPendingDraft(offlineReply.draft);
          }
          setIsLoading(false);
          setProcessingNote('');
          return;
        }
        throw fetchErr;
      }
      clearTimeout(circuitBreakerTimeout);
      abortControllerRef.current = null;
      // ── End Circuit Breaker ───────────────────────────────────────────────

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let accumulatedText = '';
        let currentEvent = 'message';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) {
              currentEvent = 'message';
              continue;
            }

            if (line.startsWith('event:')) {
              currentEvent = line.replace(/^event:\s*/, '').trim();
            } else if (line.startsWith('data:')) {
              const dataStr = line.replace(/^data:\s*/, '').trim();
              if (!dataStr) continue;

              try {
                const data = JSON.parse(dataStr);

                if (currentEvent === 'token') {
                  const tokenText = data.text !== undefined ? data.text : (data.delta || '');
                  accumulatedText += tokenText;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === aiMsgId ? { ...m, text: accumulatedText } : m))
                  );
                } else if (currentEvent === 'draft_sale') {
                  const draftData = data.draftSale || data;
                  if (draftData) {
                    setPendingDraft(draftData);
                  }
                } else if (currentEvent === 'suggested_posters') {
                  const posters = Array.isArray(data) ? data : (data.posters || []);
                  setMessages((prev) =>
                    prev.map((m) => (m.id === aiMsgId ? { ...m, suggestedPosters: posters } : m))
                  );
                } else if (currentEvent === 'done') {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsgId
                        ? {
                            ...m,
                            isStreaming: false,
                            text: accumulatedText || data.fullText || m.text || 'Entendido.',
                          }
                        : m
                    )
                  );
                } else if (currentEvent === 'error') {
                  throw new Error(data.error || 'Error en stream SSE');
                }
              } catch (parseErr) {
                console.warn('⚠️ [SSE Parse Error] No se pudo parsear frame:', parseErr, dataStr);
              }
            }
          }
        }

        // Finalizar streaming
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, isStreaming: false } : m))
        );
      } else {
        // Fallback síncrono para respuestas tradicionales JSON
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Error al comunicarse con la IA');
        }

        if (json.draftSale || json.draft) {
          setPendingDraft(json.draftSale || json.draft);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  isStreaming: false,
                  text: json.reply,
                  suggestedPosters: json.suggestedPosters || [],
                }
              : m
          )
        );
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                isStreaming: false,
                text: `⚠️ No pude responder: ${err.message}`,
              }
            : m
        )
      );
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
      const res = await authFetch('/api/sales', {
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
    <div className="w-full max-w-2xl mx-auto rounded-[36px] sm:rounded-[42px] border-[3px] sm:border-[4px] border-white shadow-2xl overflow-hidden flex flex-col bg-white relative">
      {/* Cabecera de la Tarjeta (Blanco Puro) */}
      <div className="bg-white px-5 sm:px-7 py-3.5 sm:py-4 flex items-center justify-between select-none shrink-0">
        {/* Izquierda: Squircle Negro con Icono Origami {IA} */}
        <div className="flex items-center gap-3">
          <img
            src="/brand/icon-chat-header.png"
            alt="IA"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover shadow-sm"
          />
        </div>

        {/* Centro: Título Grande "Asistente IA" */}
        <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight font-sans text-center">
          Asistente IA
        </h2>

        {/* Derecha: Badge ON LINE con Borde Esmeralda */}
        <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-emerald-500 bg-white text-emerald-600 font-extrabold text-xs tracking-wide shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>ON LINE</span>
        </div>
      </div>

      {/* Historial de Mensajes (Fondo Negro Puro) */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 no-scrollbar bg-black min-h-[380px] max-h-[460px]">
        {messages.map((m) => (
          <div key={m.id} className="space-y-2">
            <div className={`flex items-start gap-2.5 sm:gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.sender === 'ai' && (
                <div className="w-8 h-8 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 mt-0.5 shadow-sm select-none">
                  <img src="/brand/icon-chat-avatar.png" alt="IA" className="w-6 h-6 object-contain" />
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-[24px] px-4 sm:px-5 py-3 sm:py-3.5 leading-relaxed text-xs sm:text-sm ${
                  m.sender === 'user'
                    ? 'bg-[#303030] text-white border border-neutral-700 shadow-md'
                    : 'bg-[#242424] text-neutral-100 border border-neutral-800 shadow-md'
                }`}
              >
                <div className="whitespace-pre-wrap">
                  {m.text}
                  {m.isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-400 animate-pulse align-middle" />
                  )}
                </div>

                {/* Tarjetas de Sugerencias Visuales de Catálogo */}
                {m.suggestedPosters && m.suggestedPosters.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-neutral-700/70 space-y-2">
                    <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider block">
                      🎨 Obras encontradas en catálogo ({m.suggestedPosters.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {m.suggestedPosters.map((sp) => (
                        <div
                          key={sp.id}
                          className="flex items-center gap-2.5 p-2 rounded-xl bg-black border border-neutral-700 hover:border-neutral-500 transition-all shadow-sm"
                        >
                          <img
                            src={sp.thumbUrl || sp.imageUrl}
                            alt={sp.titulo}
                            className="w-10 h-14 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900 shadow"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-xs text-white block truncate">{sp.titulo}</span>
                            <span className="text-[10px] text-neutral-400 block truncate">{sp.subtitulo || sp.categoria}</span>
                            <span className="text-[11px] text-emerald-400 font-bold block mt-0.5">
                              Desde Q{sp.precioMinimo}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => addPosterToDraft(sp)}
                            className="px-2.5 py-1.5 bg-white hover:bg-neutral-200 text-black rounded-lg text-[10px] font-black shrink-0 shadow cursor-pointer transition-transform active:scale-95"
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
                    m.sender === 'user' ? 'text-neutral-400' : 'text-neutral-500'
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
          <div className="p-4 rounded-[26px] bg-[#1a1a1a] border-2 border-emerald-500/80 shadow-2xl space-y-3 animate-fadeIn text-white">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4" /> Borrador de Venta (Pendiente de Confirmar)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-neutral-400">
                  Canal: <strong className="text-white">{pendingDraft.inputChannel}</strong>
                </span>
                <button
                  type="button"
                  onClick={discardDraft}
                  className="text-neutral-400 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                  title="Descartar borrador"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
              {pendingDraft.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-black border border-neutral-800 text-xs"
                >
                  {/* Miniatura WebP */}
                  <img
                    src={it.thumbUrl || it.imageUrl}
                    alt=""
                    className="w-10 h-14 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900"
                  />

                  {/* Detalle y selector de tamaño */}
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-white block truncate">
                      {it.baseTitle || it.description}
                    </span>
                    <span className="text-[9px] text-neutral-400 uppercase font-semibold block">
                      {it.category || 'ARTE'}
                    </span>

                    {/* Selector de tamaño interactivo */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <label className="text-[10px] text-neutral-400 font-medium">Tamaño:</label>
                      <select
                        value={it.sizeId || 'MEDIANO'}
                        onChange={(e) => updateDraftItemSize(idx, e.target.value)}
                        className="bg-[#222222] border border-neutral-700 rounded px-2 py-0.5 text-[10px] text-white font-bold focus:outline-none focus:border-white cursor-pointer"
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
                      className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1 underline transition-colors cursor-pointer mt-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Cambiar diseño
                    </button>
                  </div>

                  {/* Cantidad y Subtotal */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1 bg-[#222] border border-neutral-700 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => updateDraftItemQty(idx, -1)}
                        className="w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-white rounded hover:bg-neutral-800 cursor-pointer"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className="font-bold text-xs text-white px-1">{it.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateDraftItemQty(idx, 1)}
                        className="w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-white rounded hover:bg-neutral-800 cursor-pointer"
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
                      className="text-neutral-500 hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                      title="Eliminar este póster"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Selector de Método de Pago y Total */}
            <div className="pt-2 border-t border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => updateDraftPaymentMethod(m)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                        pendingDraft.paymentMethod === m
                          ? 'bg-white text-black border-white'
                          : 'bg-black border-neutral-700 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {m === 'EFECTIVO' ? '💵 Efectivo' : m === 'TARJETA' ? '💳 Tarjeta' : '📱 Transfer'}
                    </button>
                  ))}
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-neutral-400 mr-1">Total:</span>
                  <strong className="text-emerald-400 text-sm font-black">
                    Q {pendingDraft.total?.toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-800">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={discardDraft}
                    className="px-3 py-1 rounded-lg bg-black hover:bg-red-950/50 hover:text-red-400 text-neutral-400 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onPopulateManualForm) onPopulateManualForm(pendingDraft);
                      setPendingDraft(null);
                    }}
                    className="px-3 py-1 rounded-lg bg-black hover:bg-neutral-800 text-neutral-300 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer"
                  >
                    Modificar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={confirmPendingSale}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer transition-transform active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Venta</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Indicador de carga */}
        {isLoading && (
          <div className="flex items-center gap-2 text-neutral-400 text-xs italic py-1">
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            <span>{processingNote || 'Asistente IA procesando...'}</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Modal / Overlay Flotante para Cambiar Diseño */}
      {swappingIndex !== null && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-md z-30 p-4 flex flex-col animate-fadeIn text-white">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> Seleccionar Póster de Reemplazo
            </span>
            <button
              type="button"
              onClick={closeSwapModal}
              className="text-neutral-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative my-2">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Escribe el nombre o personaje... (ej. Goku, Taylor, Spider-Man)"
              value={swapQuery}
              onChange={(e) => handleSwapSearchChange(e.target.value)}
              autoFocus
              className="w-full bg-[#161616] border border-neutral-700 rounded-full pl-8 pr-4 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 no-scrollbar pr-1">
            {isSearchingSwap ? (
              <div className="flex items-center justify-center p-6 text-xs text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-white" />
                Buscando en catálogo oficial...
              </div>
            ) : swapResults.length === 0 ? (
              <div className="text-center p-6 text-xs text-neutral-400">
                No se encontraron obras coincidentes. Escribe otras palabras clave.
              </div>
            ) : (
              swapResults.map((p) => (
                <div
                  key={p.id}
                  onClick={() => selectSwapPoster(p)}
                  className="p-2.5 rounded-xl bg-[#181818] hover:bg-[#222222] border border-neutral-800 hover:border-neutral-600 flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={p.thumbUrl || p.imageUrl}
                      alt=""
                      className="w-9 h-12 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900"
                    />
                    <div className="truncate">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
                        {p.categoria}
                      </span>
                      <span className="font-bold text-xs text-white block truncate">{p.titulo}</span>
                      <span className="text-[10px] text-neutral-400 block truncate">{p.subtitulo || ''}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-emerald-400 block">Q{p.precioMinimo}</span>
                    <span className="text-[9px] text-neutral-300 font-semibold">Seleccionar</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Barra Inferior (Blanco Puro con 4 Controles Píldora Negros) */}
      <div className="bg-white p-3.5 sm:p-5 select-none shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleImageUpload}
          className="hidden"
        />

        {isRecording ? (
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-black text-white shadow-md">
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full ${vadActive ? 'bg-amber-400 animate-pulse' : 'bg-red-500 animate-ping'}`}></span>
              <span className={`text-xs font-bold ${vadActive ? 'text-amber-400' : 'text-red-400'}`}>
                {vadActive ? 'Detectando silencio…' : `Dictando: ${formatTime(recordingSeconds)}`}
              </span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Finalizar</span>
            </button>
          </div>

        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendText();
            }}
            className="flex items-center gap-2 sm:gap-2.5"
          >
            {/* Botón 1: Micrófono (Audio) */}
            <button
              type="button"
              onClick={startRecording}
              disabled={isLoading}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black hover:bg-neutral-800 text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shrink-0 active:scale-95 shadow-md"
              title="Dictar venta por voz"
            >
              <Mic className="w-5 h-5 text-white" />
            </button>

            {/* Botón 2: Cámara (Foto) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black hover:bg-neutral-800 text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shrink-0 active:scale-95 shadow-md"
              title="Tomar foto del arte del póster"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>

            {/* Input 3: Barra de Texto Píldora Negra */}
            <input
              type="text"
              placeholder="Escribe una consulta o venta..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
              className="flex-1 h-11 sm:h-12 bg-black text-white placeholder-neutral-500 rounded-full px-5 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 shadow-inner"
            />

            {/* Botón 4: Enviar */}
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black hover:bg-neutral-800 text-white flex items-center justify-center transition-all disabled:text-neutral-500 cursor-pointer shrink-0 active:scale-95 shadow-md"
              title="Enviar"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
