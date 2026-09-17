import React, { useRef, useEffect } from 'react';
import useAiVoiceRecorder, { getSupportedAudioMimeType } from './ai-chat/hooks/useAiVoiceRecorder';
import useAiChatStream from './ai-chat/hooks/useAiChatStream';
import ChatHeader from './ai-chat/ChatHeader';
import ChatMessageList from './ai-chat/ChatMessageList';
import ChatDraftCard from './ai-chat/ChatDraftCard';
import ChatInputBar from './ai-chat/ChatInputBar';
import ChatSwapModal from './ai-chat/ChatSwapModal';
import AiErrorBanner from './ai-chat/AiErrorBanner';

export { getSupportedAudioMimeType };

export default function UnifiedAiChat({ eventId, onSaleRegistered, onPopulateManualForm }) {
  const chatContainerRef = useRef(null), chatBottomRef = useRef(null), isPinnedToBottomRef = useRef(true);
  const chatStream = useAiChatStream({ eventId, onSaleRegistered, onPopulateManualForm });
  const voiceRecorder = useAiVoiceRecorder({ onRecordingComplete: chatStream.handleVoiceUpload });

  useEffect(() => {
    if (isPinnedToBottomRef.current && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatStream.messages, chatStream.pendingDraft, voiceRecorder.isRecording, chatStream.aiError]);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="rounded-[36px] sm:rounded-[42px] border-[3px] sm:border-[4px] border-white shadow-2xl overflow-hidden flex flex-col bg-white relative">
        <ChatHeader />
        <ChatMessageList
          messages={chatStream.messages} isLoading={chatStream.isLoading} processingNote={chatStream.processingNote}
          onAddPosterToDraft={chatStream.addPosterToDraft} chatContainerRef={chatContainerRef}
          isPinnedToBottomRef={isPinnedToBottomRef} chatBottomRef={chatBottomRef}
        />
        {chatStream.aiError && (
          <AiErrorBanner
            error={chatStream.aiError}
            onDismiss={chatStream.clearAiError}
            onManualSale={() => {
              const channel = chatStream.aiError?.channel || 'MANUAL_RAPIDA';
              const note = `Fallo IA (${chatStream.aiError?.title || 'Inferencia'}) - Carga manual directa`;
              chatStream.clearAiError();
              if (onPopulateManualForm) onPopulateManualForm({ inputChannel: channel, notes: note, items: [] });
            }}
          />
        )}
        <ChatInputBar
          inputText={chatStream.inputText} setInputText={chatStream.setInputText}
          onSendText={chatStream.handleSendText} isLoading={chatStream.isLoading}
          isRecording={voiceRecorder.isRecording} recordingSeconds={voiceRecorder.recordingSeconds}
          vadActive={voiceRecorder.vadActive} audioLevel={voiceRecorder.audioLevel}
          onStartRecording={voiceRecorder.startRecording} onStopRecording={voiceRecorder.stopRecording}
          onImageUpload={chatStream.handleImageUpload}
        />
      </div>
      {chatStream.pendingDraft && (
        <ChatDraftCard
          pendingDraft={chatStream.pendingDraft}
          onUpdateSize={chatStream.updateDraftItemSize} onUpdateQty={chatStream.updateDraftItemQty}
          onRemoveItem={chatStream.removeDraftItem} onUpdatePaymentMethod={chatStream.updateDraftPaymentMethod}
          onDiscard={chatStream.discardDraft} onConfirmSale={chatStream.confirmPendingSale}
          onPopulateManualForm={onPopulateManualForm}
          onOpenSwapModal={(idx) => { chatStream.setSwappingIndex(idx); chatStream.fetchInitialSwapPosters(); }}
          isLoading={chatStream.isLoading}
        />
      )}
      <ChatSwapModal
        isOpen={chatStream.swappingIndex !== null} onClose={() => chatStream.setSwappingIndex(null)}
        swapQuery={chatStream.swapQuery} onSearchChange={chatStream.handleSwapSearchChange}
        swapResults={chatStream.swapResults} isSearchingSwap={chatStream.isSearchingSwap}
        onSelectPoster={chatStream.selectSwapPoster}
      />
    </div>
  );
}
