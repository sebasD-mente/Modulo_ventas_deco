import fs from 'fs';
import path from 'path';

console.info('📏 [ARNÉS STAND IA] Auditando límites de tamaño y deuda monolítica con criterios de dominio...');

const rootDir = process.cwd();
const dirsToScan = ['src', 'server'];

// Techos arquitectónicos específicos por dominio (evita la sobre-fragmentación de archivos cohesivos)
const DOMAIN_CEILINGS = {
  // 1. Diccionarios de datos culturales / Declarativos (Colecciones estáticas sin efectos secundarios)
  'server/services/semantic/entityAliases.js': { max: 600, reason: 'Diccionario declarativo de cultura pop' },

  // 2. Infraestructura, Rutas y Auth Lineal (Puntos de entrada y flujos de seguridad estándar)
  'server/index.js': { max: 300, reason: 'Punto de entrada Express, CORS, middlewares y cron jobs' },
  'server/routes/apiRoutes.js': { max: 300, reason: 'Manifiesto central de rutas de la API' },
  'server/controllers/authController.js': { max: 300, reason: 'Flujo lineal de seguridad Google OAuth y JWT' },
  'server/services/geminiPoolService.js': { max: 350, reason: 'Máquina de estados para rotación y pool de API Keys' },

  // 3. Herramientas, Motores RegEx compactos y Embeddings
  'server/services/ai/aiToolsService.js': { max: 250, reason: 'Catálogo oficial de Function Calling de Gemini' },
  'server/services/embeddingService.js': { max: 250, reason: 'Servicio matemático de similitud coseno y embeddings' },
  'server/services/semantic/paymentExtractor.js': { max: 280, reason: 'Motor cohesivo de expresiones regulares de pago' },
  'src/App.jsx': { max: 250, reason: 'Router y layout maestro del frontend' },
};

const DEFAULT_CEILING = 200;

function getAllCodeFiles(dir) {
  const fullDir = path.join(rootDir, dir);
  if (!fs.existsSync(fullDir)) return [];

  const results = [];
  function scan(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) {
          scan(entryPath);
        }
      } else if (/\.(js|jsx)$/i.test(entry.name)) {
        results.push(entryPath);
      }
    }
  }
  scan(fullDir);
  return results;
}

const allFiles = dirsToScan.flatMap(getAllCodeFiles);
const oversizedFiles = [];
const cohesiveFiles = [];

for (const filePath of allFiles) {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const lineCount = fs.readFileSync(filePath, 'utf-8').split('\n').length;
  const domainRule = DOMAIN_CEILINGS[relativePath];
  const maxAllowed = domainRule ? domainRule.max : DEFAULT_CEILING;

  if (lineCount > maxAllowed) {
    oversizedFiles.push({
      path: relativePath,
      lines: lineCount,
      maxAllowed,
      excess: lineCount - maxAllowed,
      reason: domainRule?.reason || null,
    });
  } else if (lineCount > DEFAULT_CEILING && domainRule) {
    cohesiveFiles.push({
      path: relativePath,
      lines: lineCount,
      maxAllowed,
      reason: domainRule.reason,
    });
  }
}

if (cohesiveFiles.length > 0) {
  console.info(`\n🟢 Archivos con Cohesión Autorizada (>200 líneas bajo techo justificado):`);
  cohesiveFiles.sort((a, b) => b.lines - a.lines);
  cohesiveFiles.forEach((item) => {
    console.info(`  ✅ ${item.path} (${item.lines}/${item.maxAllowed} líneas) — ${item.reason}`);
  });
}

console.info(`\n📊 Deuda Monolítica Real en STAND {IA} (archivos que exceden su límite):`);
if (oversizedFiles.length === 0) {
  console.info(`  ✨ ¡Excelente! Cero archivos exceden sus límites arquitectónicos.`);
} else {
  oversizedFiles.sort((a, b) => b.lines - a.lines);
  oversizedFiles.forEach((item) => {
    const badge = item.lines > item.maxAllowed * 1.75 || item.lines > 500 ? '🚨 CRÍTICO' : '⚠️ EXCEDIDO';
    console.info(`  ${badge}: ${item.path} (${item.lines} líneas | límite: ${item.maxAllowed}) [exceso: +${item.excess}]`);
  });
}

console.info(`\n💡 Total archivos que requieren despiece modular real: ${oversizedFiles.length}`);
if (oversizedFiles.length > 0) {
  console.info(`🛡️ [ARNÉS STAND IA] Alerta activa para Fred: Enfocar refactorizaciones estrictamente en estos archivos.\n`);
}

process.exit(0);

