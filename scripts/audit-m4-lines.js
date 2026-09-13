import fs from 'fs';

const files = [
  { path: 'server/services/ai/aiKeyPoolService.js', max: 119, rule: '< 120' },
  { path: 'server/services/geminiPoolService.js', max: 334, rule: '<= 334' },
  { path: 'server/services/ai/aiClosedLoopService.js', max: 119, rule: '< 120' },
  { path: 'server/services/ai/aiStreamService.js', max: 149, rule: '< 150' },
  { path: 'server/services/ai/aiToolsService.js', max: 139, rule: '< 140' },
  { path: 'server/services/ai/aiPromptService.js', max: 179, rule: '< 180' },
  { path: 'src/components/ai-chat/hooks/useAiChatAudio.js', max: 59, rule: '< 60' },
  { path: 'src/components/ai-chat/hooks/useAiVoiceRecorder.js', max: 139, rule: '< 140' },
  { path: 'src/components/ai-chat/ChatInputBar.jsx', max: 79, rule: '< 80' },
  { path: 'src/components/UnifiedAiChat.jsx', max: 79, rule: '< 80' },
  { path: 'src/components/manual-sale/hooks/useCatalogSearch.js', max: 149, rule: '< 150' },
  { path: 'src/components/ai-chat/hooks/useAiChatStream.js', max: 159, rule: '< 160' },
  { path: 'src/components/ai-chat/ChatToolCards.jsx', max: 139, rule: '< 140' },
  { path: 'src/services/catalogCacheService.js', max: 89, rule: '< 90' }
];

let allPassed = true;
console.log('=== AUDITORÍA EXACTA DE LÍNEAS (14 ARCHIVOS M4) ===');
for (const f of files) {
  if (!fs.existsSync(f.path)) {
    console.error(`MISSING: ${f.path}`);
    allPassed = false;
    continue;
  }
  const content = fs.readFileSync(f.path, 'utf8');
  const lines = content.split('\n').length;
  const passed = lines <= f.max;
  if (!passed) allPassed = false;
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | ${lines.toString().padStart(3)} líneas (techo ${f.rule.padEnd(6)}) | ${f.path}`);
}

console.log('==================================================');
console.log('RESULTADO AUDITORÍA DE LÍNEAS:', allPassed ? 'TODOS CUMPLEN (14/14)' : 'HAY ARCHIVOS QUE EXCEDEN');
process.exit(allPassed ? 0 : 1);
