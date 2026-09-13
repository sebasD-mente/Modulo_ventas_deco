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
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  onRecordingCompleteRef.current = onRecordingComplete;

  const stopRecording = useCallback(() => {
    if (hardTimeoutRef.current) { clearTimeout(hardTimeoutRef.current); hardTimeoutRef.current = null; }
    if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null; }
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    setVadActive(false); setIsRecording(false); setAudioLevel(0);
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
      const mediaRecorder = createOpusMediaRecorder(stream, selectedMime);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const actualMime = mediaRecorder.mimeType || selectedMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        if (onRecordingCompleteRef.current && audioBlob.size > 0) await onRecordingCompleteRef.current(audioBlob);
      };

      mediaRecorder.start(250);
      setIsRecording(true); setVadActive(false); setRecordingSeconds(0); setAudioLevel(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
      hardTimeoutRef.current = setTimeout(() => stopRecording(), 7000);

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioSetup = setupAudioAnalyser(stream, AudioCtx);
        if (audioSetup) {
          const { ctx: audioCtx, analyser, buffer } = audioSetup;
          if (audioCtx.state === 'suspended') await audioCtx.resume();
          audioContextRef.current = audioCtx;
          let lastSoundAt = Date.now(), startTime = Date.now(), noiseFloor = 0.003;
          const noiseSamples = [];

          vadTimerRef.current = setInterval(() => {
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
              clearInterval(vadTimerRef.current); vadTimerRef.current = null; return;
            }
            const { rms, level } = calculateDecibelsAndLevel(analyser, buffer);
            setAudioLevel(level);
            const elapsed = Date.now() - startTime;
            if (elapsed < 400) {
              noiseSamples.push(rms);
              noiseFloor = Math.max(0.006, (noiseSamples.reduce((a, b) => a + b, 0) / noiseSamples.length) * 1.35);
            }
            if (rms > noiseFloor) {
              lastSoundAt = Date.now(); setVadActive(false);
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
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      alert('No se pudo acceder al micrófono o tu navegador no soporta grabación de audio. Por favor verifica los permisos.');
    }
  }, [stopRecording]);

  useEffect(() => () => {
    if (hardTimeoutRef.current) clearTimeout(hardTimeoutRef.current);
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

  return { isRecording, recordingSeconds, vadActive, audioLevel, startRecording, stopRecording };
}

export default useAiVoiceRecorder;
