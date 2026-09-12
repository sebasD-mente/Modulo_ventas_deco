import React, { useRef } from 'react';
import { Send, Mic, Square, Camera } from 'lucide-react';
import { formatTime } from './chatConstants';

export default function ChatInputBar({
  inputText = '', setInputText, onSendText, isLoading = false,
  isRecording = false, recordingSeconds = 0, vadActive = false,
  onStartRecording, onStopRecording, onImageUpload,
}) {
  const fileInputRef = useRef(null);

  return (
    <div className="bg-white p-3.5 sm:p-5 select-none shrink-0 border-t border-slate-100">
      <input
        type="file" ref={fileInputRef} accept="image/*"
        capture="environment" onChange={onImageUpload} className="hidden"
      />

      {isRecording ? (
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-black text-white shadow-md">
          <div className="flex items-center gap-2.5">
            <span className={`w-3 h-3 rounded-full ${vadActive ? 'bg-amber-400 animate-pulse' : 'bg-red-500 animate-ping'}`} />
            <span className={`text-xs font-bold ${vadActive ? 'text-amber-400' : 'text-red-400'}`}>
              {vadActive ? 'Detectando silencio... (1.5s)' : `Dictando: ${formatTime(recordingSeconds)}`}
            </span>
          </div>
          <button
            type="button" onClick={onStopRecording}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Finalizar</span>
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); onSendText?.(); }} className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button" onClick={onStartRecording} disabled={isLoading} title="Dictar venta por voz"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black hover:bg-neutral-800 text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shrink-0 active:scale-95 shadow-md"
          >
            <Mic className="w-5 h-5 text-white" />
          </button>
          <button
            type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} title="Tomar foto del arte del póster"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black hover:bg-neutral-800 text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shrink-0 active:scale-95 shadow-md"
          >
            <Camera className="w-5 h-5 text-white" />
          </button>
          <input
            type="text" placeholder="Escribe o dicta tu venta..." value={inputText}
            onChange={(e) => setInputText?.(e.target.value)} disabled={isLoading}
            className="flex-1 h-11 sm:h-12 bg-black text-white placeholder-neutral-500 rounded-full px-5 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-400 shadow-inner"
          />
          <button
            type="submit" disabled={!inputText.trim() || isLoading} title="Enviar"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black hover:bg-neutral-800 text-white flex items-center justify-center transition-all disabled:text-neutral-500 cursor-pointer shrink-0 active:scale-95 shadow-md"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      )}
    </div>
  );
}
