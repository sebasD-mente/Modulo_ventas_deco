import { useState, useRef, useEffect, useCallback } from 'react';

export const getSupportedAudioMimeType = () => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus'];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || '';
};

export function useAiVoiceRecorder({ onRecordingComplete } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [vadActive, setVadActive] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const vadTimerRef = useRef(null);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  onRecordingCompleteRef.current = onRecordingComplete;

  const stopRecording = useCallback(() => {
    if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null; }
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    setVadActive(false);
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) throw new Error('getUserMedia not supported');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const selectedMime = getSupportedAudioMimeType();
      const mediaRecorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data?.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const actualMime = mediaRecorder.mimeType || selectedMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        if (onRecordingCompleteRef.current && audioBlob.size > 0) {
          await onRecordingCompleteRef.current(audioBlob);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setVadActive(false);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          if (audioCtx.state === 'suspended') await audioCtx.resume();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.8;
          source.connect(analyser);
          const buffer = new Float32Array(analyser.fftSize);
          let lastSoundAt = Date.now();

          vadTimerRef.current = setInterval(() => {
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
              clearInterval(vadTimerRef.current);
              vadTimerRef.current = null;
              return;
            }
            analyser.getFloatTimeDomainData(buffer);
            let sumSq = 0;
            for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i];
            const rms = Math.sqrt(sumSq / buffer.length);
            if (rms > 0.003) {
              lastSoundAt = Date.now();
              setVadActive(false);
            } else if (Date.now() - lastSoundAt > 1500) {
              stopRecording();
            } else if (Date.now() - lastSoundAt > 500) {
              setVadActive(true);
            }
          }, 100);
        }
      } catch (vadErr) {
        console.warn('[VAD] AudioContext not available, auto-stop disabled:', vadErr.message);
      }
    } catch (err) {
      console.error('Error accediendo al micrófono:', err);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      alert('No se pudo acceder al micrófono o tu navegador no soporta grabación de audio. Por favor verifica los permisos.');
    }
  }, [stopRecording]);

  useEffect(() => () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (vadTimerRef.current) clearInterval(vadTimerRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  return { isRecording, recordingSeconds, vadActive, startRecording, stopRecording };
}

export default useAiVoiceRecorder;
