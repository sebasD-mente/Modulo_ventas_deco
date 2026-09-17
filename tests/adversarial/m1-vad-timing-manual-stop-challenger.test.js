import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('⚡ Adversarial VAD Timing, Manual Stop & Monolith Challenge Suite', () => {

  describe('1. VAD Silence & Warning Timing Oracle & Stress Simulation', () => {
    // Simulator adhering strictly to useAiVoiceRecorder.js logic
    function createVadSimulator() {
      let isRecording = true;
      let vadActive = false;
      let hasSpoken = false;
      let lastSoundAt = 0;
      let stopCount = 0;

      return {
        onSpeech(timestamp) {
          hasSpoken = true;
          lastSoundAt = timestamp;
          vadActive = false;
        },
        tick(currentTimestamp) {
          if (!isRecording) return { isRecording, vadActive, hasSpoken };
          if (hasSpoken) {
            const silence = currentTimestamp - lastSoundAt;
            if (silence > 3800) {
              isRecording = false;
              stopCount++;
            } else if (silence > 2500) {
              vadActive = true;
            }
          }
          return { isRecording, vadActive, hasSpoken, stopCount };
        },
        getState() {
          return { isRecording, vadActive, hasSpoken, stopCount };
        }
      };
    }

    it('1.1. Silence at 2400ms (2.4s) does NOT trigger warning and does NOT stop recording', () => {
      const vad = createVadSimulator();
      vad.onSpeech(1000); // speaks at t=1000ms

      const state2400 = vad.tick(3400); // 2400ms of silence
      assert.strictEqual(state2400.vadActive, false, 'vadActive must be false at 2.4s of silence');
      assert.strictEqual(state2400.isRecording, true, 'isRecording must be true at 2.4s of silence');
      assert.strictEqual(state2400.stopCount, 0, 'stopRecording must NOT be called');
    });

    it('1.2. Silence at 2500ms (2.5s) boundary does NOT trigger warning yet (> 2500ms required)', () => {
      const vad = createVadSimulator();
      vad.onSpeech(1000);

      const state2500 = vad.tick(3500); // exactly 2500ms of silence
      assert.strictEqual(state2500.vadActive, false, 'vadActive must be false at exactly 2500ms');
      assert.strictEqual(state2500.isRecording, true, 'isRecording must be true');
    });

    it('1.3. Silence at 2600ms (2.6s) triggers warning (vadActive = true) but does NOT stop recording', () => {
      const vad = createVadSimulator();
      vad.onSpeech(1000);

      const state2600 = vad.tick(3600); // 2600ms of silence
      assert.strictEqual(state2600.vadActive, true, 'vadActive must be true at 2.6s of silence');
      assert.strictEqual(state2600.isRecording, true, 'isRecording must remain true at 2.6s of silence');
      assert.strictEqual(state2600.stopCount, 0, 'stopRecording must NOT be called at 2.6s');
    });

    it('1.4. Silence at 3700ms (3.7s) keeps warning active and does NOT stop recording', () => {
      const vad = createVadSimulator();
      vad.onSpeech(1000);

      const state3700 = vad.tick(4700); // 3700ms of silence
      assert.strictEqual(state3700.vadActive, true, 'vadActive must be true at 3.7s of silence');
      assert.strictEqual(state3700.isRecording, true, 'isRecording must remain true at 3.7s of silence');
      assert.strictEqual(state3700.stopCount, 0, 'stopRecording must NOT be called at 3.7s');
    });

    it('1.5. Silence at 3800ms (3.8s) boundary does NOT stop yet (> 3800ms required)', () => {
      const vad = createVadSimulator();
      vad.onSpeech(1000);

      const state3800 = vad.tick(4800); // exactly 3800ms of silence
      assert.strictEqual(state3800.vadActive, true, 'vadActive must remain true');
      assert.strictEqual(state3800.isRecording, true, 'isRecording must remain true at exactly 3800ms');
      assert.strictEqual(state3800.stopCount, 0, 'stopRecording must NOT be called at exactly 3800ms');
    });

    it('1.6. Silence at 3801ms+ (e.g. 3900ms) triggers automatic stop', () => {
      const vad = createVadSimulator();
      vad.onSpeech(1000);

      const state3900 = vad.tick(4900); // 3900ms of silence
      assert.strictEqual(state3900.isRecording, false, 'isRecording must become false at 3.9s of silence');
      assert.strictEqual(state3900.stopCount, 1, 'stopRecording must have been called exactly once');
    });

    it('1.7. Resuming speech during warning window resets vadActive and silence timer', () => {
      const vad = createVadSimulator();
      vad.onSpeech(1000);

      // Silence at 2800ms: warning is active
      const stateWarn = vad.tick(3800);
      assert.strictEqual(stateWarn.vadActive, true);
      assert.strictEqual(stateWarn.isRecording, true);

      // User speaks again at t=4000ms
      vad.onSpeech(4000);
      const stateReset = vad.getState();
      assert.strictEqual(stateReset.vadActive, false, 'vadActive must reset to false immediately when speech is detected');

      // Check at t=5500 (1500ms since new speech) -> no warning, no stop
      const stateAfter = vad.tick(5500);
      assert.strictEqual(stateAfter.vadActive, false, 'No warning at 1500ms of new silence');
      assert.strictEqual(stateAfter.isRecording, true, 'Recording continues normally');
    });
  });

  describe('2. Manual Stop Precedence & Discard Threshold Evaluation', () => {
    // Evaluator replicating useAiVoiceRecorder.js onstop logic exactly:
    // const isEmpty = audioBlob.size === 0 || duration < 300 || (!isManualStopRef.current && !hasSpokenRef.current && duration < 1200);
    function evaluateIsEmpty({ blobSize, duration, isManualStop, hasSpoken }) {
      return blobSize === 0 || duration < 300 || (!isManualStop && !hasSpoken && duration < 1200);
    }

    it('2.1. Manual stop at 350ms with data is NOT discarded as empty', () => {
      const isEmpty = evaluateIsEmpty({
        blobSize: 1024,
        duration: 350,
        isManualStop: true,
        hasSpoken: false,
      });
      assert.strictEqual(isEmpty, false, 'Manual stop at 350ms with data must NOT be considered empty');
    });

    it('2.2. Manual stop at 500ms without hasSpoken is NOT discarded as empty', () => {
      const isEmpty = evaluateIsEmpty({
        blobSize: 2048,
        duration: 500,
        isManualStop: true,
        hasSpoken: false, // Low whisper or quick dictation
      });
      assert.strictEqual(isEmpty, false, 'Manual stop at 500ms must bypass hasSpoken restriction and NOT be discarded');
    });

    it('2.3. Manual stop under 300ms (e.g. 250ms accidental click) IS discarded as empty', () => {
      const isEmpty = evaluateIsEmpty({
        blobSize: 512,
        duration: 250,
        isManualStop: true,
        hasSpoken: false,
      });
      assert.strictEqual(isEmpty, true, 'Accidental micro-clicks under 300ms must be discarded');
    });

    it('2.4. Automatic stop at 800ms without hasSpoken IS discarded as empty', () => {
      const isEmpty = evaluateIsEmpty({
        blobSize: 1024,
        duration: 800,
        isManualStop: false,
        hasSpoken: false,
      });
      assert.strictEqual(isEmpty, true, 'Automatic stop under 1200ms without speech must be discarded as empty');
    });

    it('2.5. Automatic stop at 1500ms with hasSpoken is NOT discarded', () => {
      const isEmpty = evaluateIsEmpty({
        blobSize: 4096,
        duration: 1500,
        isManualStop: false,
        hasSpoken: true,
      });
      assert.strictEqual(isEmpty, false, 'Automatic stop with speech detected must NOT be discarded');
    });

    it('2.6. Zero-byte blob is ALWAYS discarded regardless of manual stop or duration', () => {
      const isEmptyManual = evaluateIsEmpty({
        blobSize: 0,
        duration: 5000,
        isManualStop: true,
        hasSpoken: true,
      });
      assert.strictEqual(isEmptyManual, true, 'Zero-byte blob must always be empty');
    });
  });

  describe('3. Noise Floor Clamping & Voice Threshold Robustness', () => {
    // Replicating useAiVoiceRecorder.js noise calculation
    function computeNoiseFloorAndVoiceThreshold(noiseSamples) {
      const avg = noiseSamples.reduce((a, b) => a + b, 0) / noiseSamples.length;
      const noiseFloor = Math.max(0.006, Math.min(0.018, avg * 1.35));
      const voiceThreshold = Math.max(0.012, Math.min(0.028, noiseFloor * 1.6));
      return { noiseFloor, voiceThreshold };
    }

    it('3.1. Under extreme background noise (0.05 - 0.08), noise floor clamps to max 0.018 and voice threshold to 0.028', () => {
      const loudSamples = [0.05, 0.08, 0.06, 0.07];
      const { noiseFloor, voiceThreshold } = computeNoiseFloorAndVoiceThreshold(loudSamples);
      assert.strictEqual(noiseFloor, 0.018, 'noiseFloor must clamp at 0.018 in noisy venue');
      assert.strictEqual(voiceThreshold, 0.028, 'voiceThreshold must clamp at 0.028 in noisy venue');
    });

    it('3.2. Under absolute silence / muted mic (0.0001), noise floor clamps to min 0.006 and voice threshold to 0.012', () => {
      const quietSamples = [0.0001, 0.0002, 0.0001];
      const { noiseFloor, voiceThreshold } = computeNoiseFloorAndVoiceThreshold(quietSamples);
      assert.strictEqual(noiseFloor, 0.006, 'noiseFloor must clamp at minimum 0.006');
      assert.strictEqual(voiceThreshold, 0.012, 'voiceThreshold must clamp at minimum 0.012');
    });

    it('3.3. Under normal stand ambiance (0.008), noise floor and voice threshold scale dynamically within boundaries', () => {
      const normalSamples = [0.008, 0.009, 0.008, 0.007];
      const { noiseFloor, voiceThreshold } = computeNoiseFloorAndVoiceThreshold(normalSamples);
      assert.ok(noiseFloor >= 0.006 && noiseFloor <= 0.018, `noiseFloor ${noiseFloor} within bounds`);
      assert.ok(voiceThreshold >= 0.012 && voiceThreshold <= 0.028, `voiceThreshold ${voiceThreshold} within bounds`);
      assert.ok(voiceThreshold > noiseFloor, 'voiceThreshold must be higher than noiseFloor');
    });
  });

  describe('4. VU-Meter Smoothing & Peak-Decay Filter Dynamics', () => {
    // Replicating: const smoothLevel = Math.max(level, Math.round(prevLevel * 0.72));
    function applyDecayStep(level, prevLevel) {
      return Math.max(level, Math.round(prevLevel * 0.72));
    }

    it('4.1. Fast attack: responds immediately to sharp volume peak without lag', () => {
      let prevLevel = 0;
      const attackStep = applyDecayStep(95, prevLevel);
      assert.strictEqual(attackStep, 95, 'Attack must be instantaneous with zero lag');
    });

    it('4.2. Peak-decay smoothly fades during silence with decay factor 0.72', () => {
      let level = 100;
      const history = [level];
      for (let i = 0; i < 5; i++) {
        level = applyDecayStep(0, level);
        history.push(level);
      }
      assert.deepStrictEqual(history, [100, 72, 52, 37, 27, 19], 'Decay sequence must match 0.72 multiplier');
    });
  });

  describe('5. Monolith Ceilings & Structural Code Inspection', () => {
    const limits = [
      { file: 'src/components/ai-chat/hooks/useAiVoiceRecorder.js', max: 140, strictLessThan: true },
      { file: 'server/services/ai/aiPromptService.js', max: 180, strictLessThan: true },
      { file: 'server/services/ai/aiMediaService.js', max: 200, strictLessThan: false },
      { file: 'server/controllers/ai/aiMediaController.js', max: 180, strictLessThan: false },
      { file: 'src/components/ai-chat/ChatInputBar.jsx', max: 80, strictLessThan: true },
    ];

    for (const { file, max, strictLessThan } of limits) {
      it(`5.x. ${file} must have ${strictLessThan ? '<' : '<='} ${max} lines`, () => {
        const fullPath = path.resolve(file);
        assert.ok(fs.existsSync(fullPath), `File ${file} must exist`);
        const lines = fs.readFileSync(fullPath, 'utf8').split('\n').length;
        if (strictLessThan) {
          assert.ok(lines < max, `File ${file} has ${lines} lines, expected < ${max}`);
        } else {
          assert.ok(lines <= max, `File ${file} has ${lines} lines, expected <= ${max}`);
        }
      });
    }

    it('5.6. ChatInputBar.jsx has cancellation button and Square finalize button', () => {
      const inputBarContent = fs.readFileSync(path.resolve('src/components/ai-chat/ChatInputBar.jsx'), 'utf8');
      assert.match(inputBarContent, /onCancelRecording/, 'ChatInputBar must receive onCancelRecording');
      assert.match(inputBarContent, /onStopRecording/, 'ChatInputBar must receive onStopRecording');
      assert.match(inputBarContent, /Square/, 'ChatInputBar must render Square icon for stop');
      assert.match(inputBarContent, /Pausa detectada\.\.\. finalizando/, 'ChatInputBar must render pause text');
    });

    it('5.7. useAiVoiceRecorder.js has exact thresholds 3800 and 2500', () => {
      const hookContent = fs.readFileSync(path.resolve('src/components/ai-chat/hooks/useAiVoiceRecorder.js'), 'utf8');
      assert.match(hookContent, /silence\s*>\s*3800/, 'useAiVoiceRecorder must have silence > 3800');
      assert.match(hookContent, /silence\s*>\s*2500/, 'useAiVoiceRecorder must have silence > 2500');
      assert.match(hookContent, /isManualStopRef\.current\s*=\s*true/, 'stopRecording must set isManualStopRef.current = true');
    });
  });

});
