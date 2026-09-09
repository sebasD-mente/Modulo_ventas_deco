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
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function UnifiedAiChat({ eventId, onSaleRegistered, onPopulateManualForm }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: '¡Hola! Soy tu Asistente de Ventas IA. Puedes dictarme ventas por voz con el micrófono 🎙️, tomar fotos del arte o códigos 📷, o preguntarme sobre métricas en vivo.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingNote, setProcessingNote] = useState('');
  const [pendingDraft, setPendingDraft] = useState(null);

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

  // Enviar audio a Gemini 3.8 Flash
  const handleAudioSale = async (audioBlob) => {
    setIsLoading(true);
    setProcessingNote('Gemini 3.8 analizando dictado de voz y buscando pósters en catálogo...');

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
          text: `Entendí tu dictado: "${data.draftSale.transcription || 'Venta extraída'}". Por favor verifica los ítems y confirma el asiento en la base de datos:`,
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

  // Manejar captura de imagen (Reconocimiento visual de arte o QR)
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setProcessingNote('Gemini 3.8 Vision analizando imagen contra los 233 pósters web...');

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: 'user',
        text: '📷 [Foto de póster / arte enviada para reconocimiento]',
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
    setProcessingNote('Consultando datos en PostgreSQL...');

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
    setProcessingNote('Asentando venta inmutable en PostgreSQL VPS...');

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
      inputChannel: pendingDraft.inputChannel || 'IA_VOZ',
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

      // Celebración visual
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

  // Formato tiempo de grabación
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="glass-card rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col h-[380px] sm:h-[400px]">
      {/* Cabecera del Chat */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
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
            <span className="text-[10px] text-slate-400">Micro y cámara integrados en la barra</span>
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
            onClick={() => handleSendText('¿Cuál es el método de pago más usado?')}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
          >
            💳 Métodos
          </button>
        </div>
      </div>

      {/* Historial de Mensajes con Scroll */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 no-scrollbar text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
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
              <div
                className={`text-[9px] mt-1 text-right ${
                  m.sender === 'user' ? 'text-slate-900/70 font-bold' : 'text-slate-500'
                }`}
              >
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}

        {/* Tarjeta de Borrador Detectado Human-in-the-Loop */}
        {pendingDraft && (
          <div className="p-3 rounded-xl bg-slate-900 border-2 border-amber-500/60 shadow-xl space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5" /> Venta Detectada por IA
              </span>
              <span className="text-[10px] text-slate-400">
                Canal: <strong className="text-slate-200">{pendingDraft.inputChannel}</strong>
              </span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
              {pendingDraft.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px]"
                >
                  {(it.thumbUrl || it.imageUrl) && (
                    <img
                      src={it.thumbUrl || it.imageUrl}
                      alt=""
                      className="w-7 h-9 object-cover rounded border border-slate-700 shrink-0"
                    />
                  )}
                  <div className="flex-1 truncate">
                    <span className="font-semibold text-slate-200 block truncate">{it.description}</span>
                    <span className="text-[10px] text-slate-400">Q {Number(it.unitPrice).toFixed(2)} c/u</span>
                  </div>
                  <span className="font-bold text-slate-300">x{it.quantity}</span>
                  <span className="font-bold text-emerald-400">
                    Q {(it.quantity * it.unitPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-300">
                Total: <strong className="text-emerald-400 text-sm">Q {pendingDraft.total?.toFixed(2)}</strong> (
                {pendingDraft.paymentMethod || 'EFECTIVO'})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (onPopulateManualForm) onPopulateManualForm(pendingDraft);
                    setPendingDraft(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Modificar
                </button>
                <button
                  type="button"
                  onClick={confirmPendingSale}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-[11px] font-extrabold flex items-center gap-1 shadow-md shadow-emerald-600/20 cursor-pointer"
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

      {/* Barra de Entrada Unificada con Micrófono y Cámara Integrados */}
      <div className="p-2.5 bg-slate-900/95 border-t border-slate-800">
        {/* Input oculto para cámara */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* Estado de Grabación en Curso */}
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
            {/* Botón de Grabación de Audio (🎙️) */}
            <button
              type="button"
              onClick={startRecording}
              disabled={isLoading}
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 flex items-center justify-center transition-all shadow-md shadow-amber-500/20 disabled:opacity-40 cursor-pointer shrink-0"
              title="Dictar venta por voz"
            >
              <Mic className="w-4 h-4 font-bold" />
            </button>

            {/* Botón de Cámara / Arte Visual (📷) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-amber-400 flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shrink-0"
              title="Tomar foto del arte o código del póster"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Input de Texto */}
            <input
              type="text"
              placeholder="Dicta 🎙️, toma foto 📷, escribe una venta o consulta..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-medium"
            />

            {/* Botón Enviar */}
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
