import React from 'react';
import { Loader2 } from 'lucide-react';
import ChatToolCards from './ChatToolCards';

export default function ChatMessageList({
  messages = [], isLoading = false, processingNote = '', onAddPosterToDraft, onAddPoster,
  chatContainerRef, isPinnedToBottomRef, chatBottomRef, children
}) {
  const handleScroll = () => {
    const c = chatContainerRef?.current;
    if (c && isPinnedToBottomRef) isPinnedToBottomRef.current = (c.scrollHeight - c.scrollTop - c.clientHeight <= 80);
  };
  const addFn = onAddPosterToDraft || onAddPoster;

  const renderContent = (txt) => {
    if (!txt) return null;
    return txt.split('\n').map((line, i) => (
      <span key={i} className={`block ${line.startsWith('• ') || line.startsWith('- ') ? 'pl-2' : ''}`}>
        {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? <strong key={j} className="font-bold text-white">{part.slice(2, -2)}</strong> : part
        )}
      </span>
    ));
  };

  return (
    <div
      ref={chatContainerRef}
      onScroll={handleScroll}
      className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 no-scrollbar bg-black min-h-[380px] max-h-[460px]"
    >
      {messages.map((m, idx) => (
        <div key={m.id ? `${m.id}-${idx}` : idx} className="space-y-2">
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
                {renderContent(m.text)}
                {m.isStreaming && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-400 animate-pulse align-middle" />
                )}
              </div>
              <ChatToolCards message={m} msg={m} onAddPoster={addFn} onAddPosterToDraft={addFn} />
            </div>
          </div>
        </div>
      ))}
      {children}
      {isLoading && processingNote && (
        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#181818] border border-neutral-800 text-xs text-neutral-300">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
          <span>{processingNote}</span>
        </div>
      )}
      <div ref={chatBottomRef} />
    </div>
  );
}
