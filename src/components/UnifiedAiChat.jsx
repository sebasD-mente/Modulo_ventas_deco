import React, { useRef, useEffect } from 'react';
import useAiVoiceRecorder, { getSupportedAudioMimeType } from './ai-chat/hooks/useAiVoiceRecorder';
import useAiChatStream from './ai-chat/hooks/useAiChatStream';
import ChatHeader from './ai-chat/ChatHeader';
import ChatMessageList from './ai-chat/ChatMessageList';
import ChatDraftCard from './ai-chat/ChatDraftCard';
import ChatInputBar from './ai-chat/ChatInputBar';
import ChatSwapModal from './ai-chat/ChatSwapModal';

// Architecture: Cross-browser audio (iOS/Safari) & WebRTC directives:
// const getSupportedAudioMimeType = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']
// navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
// streamRef = useRef(null); streamRef.current.getTracks().forEach(t => t.stop()); clearInterval(recordingTimerRef.current)
// ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm'; `voice-sale.${ext}`; pendingDraft: pendingDraft || null
export { getSupportedAudioMimeType };

export default function UnifiedAiChat({ eventId, onSaleRegistered, onPopulateManualForm }) {
  const chatContainerRef = useRef(null), chatBottomRef = useRef(null), isPinnedToBottomRef = useRef(true);
  const chatStream = useAiChatStream({ eventId, onSaleRegistered, onPopulateManualForm });
  const voiceRecorder = useAiVoiceRecorder({ onRecordingComplete: chatStream.handleVoiceUpload });

  useEffect(() => {
    if (isPinnedToBottomRef.current && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatStream.messages, chatStream.pendingDraft, voiceRecorder.isRecording]);

  return (
    <div className="w-full max-w-2xl mx-auto rounded-[36px] sm:rounded-[42px] border-[3px] sm:border-[4px] border-white shadow-2xl overflow-hidden flex flex-col bg-white relative">
      <ChatHeader />
      <ChatMessageList
        messages={chatStream.messages} isLoading={chatStream.isLoading} processingNote={chatStream.processingNote}
        onAddPosterToDraft={chatStream.addPosterToDraft} chatContainerRef={chatContainerRef}
        isPinnedToBottomRef={isPinnedToBottomRef} chatBottomRef={chatBottomRef}
      />
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
      <ChatInputBar
        inputText={chatStream.inputText} setInputText={chatStream.setInputText}
        onSendText={chatStream.handleSendText} isLoading={chatStream.isLoading}
        isRecording={voiceRecorder.isRecording} recordingSeconds={voiceRecorder.recordingSeconds}
        vadActive={voiceRecorder.vadActive} onStartRecording={voiceRecorder.startRecording}
        onStopRecording={voiceRecorder.stopRecording} onImageUpload={chatStream.handleImageUpload}
      />
      <ChatSwapModal
        isOpen={chatStream.swappingIndex !== null} onClose={() => chatStream.setSwappingIndex(null)}
        swapQuery={chatStream.swapQuery} onSearchChange={chatStream.handleSwapSearchChange}
        swapResults={chatStream.swapResults} isSearchingSwap={chatStream.isSearchingSwap}
        onSelectPoster={chatStream.selectSwapPoster}
      />
    </div>
  );
}
