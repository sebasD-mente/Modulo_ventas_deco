export const OPUS_BITRATE = 24000;

export function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus'];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || '';
}

export function createOpusMediaRecorder(stream, mimeType) {
  try {
    return new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: OPUS_BITRATE });
  } catch (_) {
    return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  }
}

export function setupAudioAnalyser(stream, AudioCtxClass) {
  if (!AudioCtxClass) return null;
  const ctx = new AudioCtxClass();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.4;
  source.connect(analyser);
  return { ctx, analyser, buffer: new Float32Array(analyser.fftSize) };
}

export function calculateDecibelsAndLevel(analyser, buffer, ceilingRms = 0.12) {
  if (!analyser || !buffer) return { rms: 0, level: 0 };
  analyser.getFloatTimeDomainData(buffer);
  let sumSq = 0;
  for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i];
  const rms = Math.sqrt(sumSq / buffer.length);
  const level = Math.min(100, Math.max(0, Math.round((rms / ceilingRms) * 100)));
  return { rms, level };
}
