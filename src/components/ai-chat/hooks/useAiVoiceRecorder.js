import { useState, useRef, useEffect, useCallback } from 'react';
import {
  getSupportedAudioMimeType,
  createOpusMediaRecorder,
  setupAudioAnalyser,
  calculateDecibelsAndLevel,
} from './useAiChatAudio.js';

export { getSupportedAudioMimeType };

export function useAiVoiceRecorder({ onRecordingComplete } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [vadActive, setVadActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef(null), streamRef = useRef(null), audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null), audioContextRef = useRef(null), vadTimerRef = useRef(null), hardTimeoutRef = useRef(null);
  const hasSpokenRef = useRef(false), recordingStartTimeRef = useRef(0), isCancelledRef = useRef(false), isManualStopRef = useRef(false);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  onRecordingCompleteRef.current = onRecordingComplete;

  const stopRecording = useCallback(() => {
    isManualStopRef.current = true;
    if (hardTimeoutRef.current) { clearTimeout(hardTimeoutRef.current); hardTimeoutRef.current = null; }
    if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null; }
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    setVadActive(false); setIsRecording(false); setAudioLevel(0);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.requestData?.(); mediaRecorderRef.current.stop(); } catch (_) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;
    audioChunksRef.current = [];
    stopRecording();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, [stopRecording]);

  const startRecording = useCallback(async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) throw new Error('getUserMedia not supported');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const selectedMime = getSupportedAudioMimeType();
      const mediaRecorder = createOpusMediaRecorder(stream, selectedMime);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      hasSpokenRef.current = false; isManualStopRef.current = false;
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        if (isCancelledRef.current) { isCancelledRef.current = false; audioChunksRef.current = []; return; }
        const actualMime = mediaRecorder.mimeType || selectedMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        const duration = Date.now() - recordingStartTimeRef.current;
        if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        if (onRecordingCompleteRef.current) {
          const isEmpty = audioBlob.size === 0 || duration < 300 || (!isManualStopRef.current && !hasSpokenRef.current && duration < 1200);
          await onRecordingCompleteRef.current(isEmpty ? null : audioBlob, { empty: isEmpty });
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true); setVadActive(false); setRecordingSeconds(0); setAudioLevel(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
      hardTimeoutRef.current = setTimeout(() => stopRecording(), 15000);

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioSetup = setupAudioAnalyser(stream, AudioCtx);
        if (audioSetup) {
          const { ctx: audioCtx, analyser, buffer } = audioSetup;
          if (audioCtx.state === 'suspended') await audioCtx.resume();
          audioContextRef.current = audioCtx;
          let lastSoundAt = Date.now(), startTime = Date.now(), noiseFloor = 0.003, prevLevel = 0;
          const noiseSamples = [];

          vadTimerRef.current = setInterval(() => {
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
              clearInterval(vadTimerRef.current); vadTimerRef.current = null; return;
            }
            const { rms, level } = calculateDecibelsAndLevel(analyser, buffer, 0.035);
            const smoothLevel = Math.max(level, Math.round(prevLevel * 0.72)); prevLevel = smoothLevel;
            setAudioLevel(smoothLevel);
            const elapsed = Date.now() - startTime;
            if (elapsed < 400) {
              noiseSamples.push(rms);
              noiseFloor = Math.max(0.006, Math.min(0.018, (noiseSamples.reduce((a, b) => a + b, 0) / noiseSamples.length) * 1.35));
            }
            const voiceThreshold = Math.max(0.012, Math.min(0.028, noiseFloor * 1.6));
            if (rms > voiceThreshold) {
              hasSpokenRef.current = true; lastSoundAt = Date.now(); setVadActive(false);
            } else if (hasSpokenRef.current) {
              const silence = Date.now() - lastSoundAt;
              if (silence > 3800) stopRecording();
              else if (silence > 2500) setVadActive(true);
            }
          }, 100);
        }
      } catch (vadErr) {
        console.warn('[VAD] AudioContext not available, auto-stop disabled:', vadErr.message);
      }
    } catch (err) {
      console.error('Error accediendo al micrófono:', err);
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      alert('No se pudo acceder al micrófono o tu navegador no soporta grabación de audio. Por favor verifica los permisos.');
    }
  }, [stopRecording]);

  useEffect(() => () => {
    if (hardTimeoutRef.current) clearTimeout(hardTimeoutRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { try { mediaRecorderRef.current.stop(); } catch (_) {} }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (vadTimerRef.current) clearInterval(vadTimerRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }
  }, []);

  return { isRecording, recordingSeconds, vadActive, audioLevel, startRecording, stopRecording, cancelRecording };
}

export default useAiVoiceRecorder;
