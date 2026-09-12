import React from 'react';

export default function ChatHeader() {
  return (
    <div className="bg-white px-5 sm:px-7 py-3.5 sm:py-4 flex items-center justify-between select-none shrink-0 border-b border-slate-100 z-10">
      <div className="flex items-center gap-3">
        <img
          src="/brand/icon-chat-header.png"
          alt="IA"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover shadow-sm"
        />
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight leading-none">
            Asistente IA
          </h2>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
            STAND &#123;IA&#125; • Gemini 3.6 Flash
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-200/60 bg-emerald-50 text-emerald-600 font-extrabold text-[10px] tracking-wide shadow-sm">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>ON LINE</span>
      </div>
    </div>
  );
}
