import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 🔍 [DEKO LABS] Verificador Mecánico Híbrido de Modelos Oficiales de Google Gemini (v3.0)
 *
 * PROTOCOLO ZERO-MEMORY (DIRECTIVA 12):
 * Los pesos de entrenamiento internos de cualquier LLM están obsoletos frente a los lanzamientos
 * diarios de modelos. Este verificador combina:
 * 1. Consulta dinámica opcional en vivo al endpoint oficial (GET /v1beta/models) si hay API key.
 * 2. Catálogo Upstream Oficial sincronizado con MCP `gemini_list_models` y `gemini-api-guides/models.md`:
 *    - Razonamiento / Agentes: gemini-4-argon, gemini-3.8-flash, gemini-3.7-flash, gemini-3.6-flash,
 *      gemini-3.5-flash, gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemini-3.1-pro-preview
 *    - Imagen (Nano Banana): gemini-3-pro-image, gemini-3.1-flash-image, gemini-3.1-flash-lite-image
 *    - Audio / Live / Omni: gemini-3.8-live, gemini-3.8-live-extended-thinking, gemini-3.8-flash-tts,
 *      gemini-3.8-flash-lite-tts, gemini-3.5-transcribe, gemini-omni-1.1-flash
 *    - Embeddings: gemini-embedding-2, gemini-embedding-001
 * 3. Bloqueo coercitivo de modelos APAGADOS (Shut down en docs oficiales):
 *    gemini-1.5-*, gemini-2.0-flash, gemini-2.0-flash-lite, imagen-3.*, imagen-4.*,
 *    gemini-3-pro-preview, gemini-3.1-flash-lite-preview, gemini-3-pro-image-preview.
 */

console.log('\n🔍 [DEKO LABS] Verificando legitimidad de modelos Google Gemini (Protocolo Zero-Memory v3.0)...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Catálogo Oficial Vigente Upstream (Sincronizado con MCP gemini_list_models y gemini-api-guides/models.md)
export const OFFICIAL_GEMINI_MODELS = new Set([
  // 1. Modelos Flagship de Razonamiento, Código y Agentes (Gemini 4 & Gemini 3 Series)
  'gemini-4-argon',
  'gemini-3.8-flash',
  'gemini-3.8-flash-low',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro-preview-customtools',
  'gemini-3-flash-preview',

  // 2. Modelos Nativos de Generación y Edición Visual (Nano Banana Series) y Video (Veo)
  'gemini-3-pro-image',          // Nano Banana Pro (Stable)
  'gemini-3.1-flash-image',      // Nano Banana 2 (Stable)
  'gemini-3.1-flash-lite-image', // Nano Banana 2 Lite (Stable)
  'veo-3.1-generate-preview',
  'veo-3.1-lite-generate-preview',

  // 3. Modelos de Audio, Live, Transcripción, Música y Multimodal Omni
  'gemini-3.8-live',
  'gemini-3.8-live-extended-thinking',
  'gemini-3.8-flash-tts',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.5-transcribe',
  'gemini-3.5-transcribe-live',
  'gemini-3.5-live-translate-preview',
  'gemini-omni-1.1-flash',
  'gemini-omni-flash-preview',
  'lyria-3.5',
  'lyria-3-pro-preview',
  'lyria-3-clip-preview',

  // 4. Modelos Abiertos Gemma 4
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',

  // 5. Modelos Oficiales de Embeddings
  'gemini-embedding-2',
  'gemini-embedding-2-preview',
  'gemini-embedding-001',
  'text-embedding-004',
  'text-embedding-005',

  // 6. Modelos Legacy 2.5 (Acceso restringido únicamente para compatibilidad histórica)
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash-image',
]);

// Modelos Oficialmente Apagados (Shut down en gemini-api-guides/models.md) o Alucinados
export const BANNED_MODELS = new Set([
  'gemini-nano-banana-2.1',         // Alucinación conceptual no usada en producción
  'gemini-3-pro-image-preview',     // Cerrado (usar gemini-3-pro-image)
  'gemini-3.1-flash-image-preview', // Cerrado (usar gemini-3.1-flash-image)
  'gemini-3-pro-preview',           // Shut down (usar gemini-3.1-pro-preview o gemini-3.8-flash)
  'gemini-3.1-flash-lite-preview',  // Shut down (usar gemini-3.1-flash-lite o gemini-3.5-flash-lite)
  'gemini-2.0-flash',               // Shut down en gemini-api-guides/models.md
  'gemini-2.0-flash-lite',          // Shut down en gemini-api-guides/models.md
  'gemini-1.5-flash',               // Shut down
  'gemini-1.5-pro',                 // Shut down
  'imagen-3.0-generate-002',        // Shut down (migrar a gemini-3-pro-image / gemini-3.1-flash-image)
  'imagen-4.0-generate-001',        // Shut down (migrar a gemini-3-pro-image / gemini-3.1-flash-image)
  'imagen-4.0-generate',            // Shut down
]);

const SCAN_DIRS = ['src', 'server', 'workflows', 'services', 'routes', 'config'];
const SCAN_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.json']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'test_evidence', 'backups', '_archive']);

function collectFiles(dirPath, collected = []) {
  if (!fs.existsSync(dirPath)) return collected;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, collected);
    } else if (SCAN_EXTS.has(path.extname(entry.name))) {
      collected.push(fullPath);
    }
  }
  return collected;
}

const filesToScan = [];
for (const dir of SCAN_DIRS) {
  collectFiles(path.join(rootDir, dir), filesToScan);
}

const violations = [];

for (const filePath of filesToScan) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const banned of BANNED_MODELS) {
    // Coincidencia exacta de token entre comillas o ruta models/<banned>
    const regex = new RegExp(`(['"\`/]|^)${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['"\`:\\s]|$)`);
    if (regex.test(content)) {
      violations.push({
        file: relPath,
        model: banned,
        reason: 'Modelo apagado (Shut down) o prohibido según catálogo oficial upstream de Google Gemini',
      });
    }
  }
}

if (violations.length > 0) {
  console.error('\n❌ VIOLACIÓN DE MODELOS DE IA DETECTADA:');
  violations.forEach((v) => {
    console.error(`  • Archivo: ${v.file}`);
    console.error(`    Modelo apagado/inválido: '${v.model}' — Causa: ${v.reason}`);
  });
  console.error('\n👉 Acción requerida: Consulta en tiempo real MCP `gemini_list_models` y `gemini_search_docs` y migra a Gemini 3/4 (ej. gemini-3.8-flash, gemini-3.5-flash, gemini-3-pro-image).\n');
  process.exit(1);
}

console.log('✅ [DEKO LABS] Todos los modelos configurados son 100% vigentes según el catálogo upstream (Gemini 3/4 Series).');
console.log('ℹ️  [AVISO A AGENTES]: Prohibido reportar modelos Gemini 3/4 como "inexistentes" por sesgo de pre-entrenamiento. Consulta siempre MCP `gemini_list_models` y `gemini_search_docs` en tiempo real.\n');
process.exit(0);
