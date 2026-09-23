import fs from 'fs';
import path from 'path';

console.info('📏 [ARNÉS STAND IA] Auditando límites de tamaño y deuda monolítica con criterios de dominio...');

const rootDir = process.cwd();
const dirsToScan = ['src', 'server'];

// Techos arquitectónicos específicos por dominio (evita la sobre-fragmentación de archivos cohesivos)
// Techos arquitectónicos fundamentados con holgura de evolución para archivos cohesivos
const DOMAIN_CEILINGS = {
  // 1. Diccionarios de datos culturales / Declarativos (Colecciones estáticas sin efectos secundarios)
  'server/services/semantic/entityAliases.js': { max: 1000, reason: 'Diccionario declarativo de cultura pop y entidades' },
  'server/services/semantic/paymentExtractor.js': { max: 400, reason: 'Motor cohesivo de expresiones regulares de pago' },

  // 2. Infraestructura, Rutas y Auth Lineal (Puntos de entrada y flujos de seguridad estándar)
  'server/routes/apiRoutes.js': { max: 500, reason: 'Manifiesto central de rutas de la API de STAND {IA}' },
  'server/index.js': { max: 450, reason: 'Punto de entrada Express, CORS, middlewares y cron jobs' },
  'src/App.jsx': { max: 400, reason: 'Router y layout maestro del frontend' },
  'server/controllers/authController.js': { max: 400, reason: 'Flujo lineal de seguridad Google OAuth y JWT' },
  'server/services/geminiPoolService.js': { max: 500, reason: 'Máquina de estados para rotación y pool de API Keys' },

  // 3. Herramientas, Motores de IA y Catálogos
  'server/services/ai/aiToolsService.js': { max: 400, reason: 'Catálogo oficial de Function Calling de Gemini (8 herramientas) y validación de borradores' },
  'server/services/ai/aiMediaService.js': { max: 350, reason: 'Orquestador multimodal de medios e inferencia' },
  'server/services/catalog/webCatalogService.js': { max: 350, reason: 'Motor de emparejamiento léxico y resolución de formatos de catálogo' },
  'server/services/catalog/liveCatalogSyncService.js': { max: 350, reason: 'Sincronizador en vivo de catálogo' },
  'server/services/embeddingService.js': { max: 350, reason: 'Servicio matemático de similitud coseno y embeddings' },

  // 4. Servicios Transaccionales y Controladores Dominio Vendedor de Redes, Taller y Comisiones
  'server/services/sales/remoteSaleService.js': { max: 500, reason: 'Servicio transaccional cohesivo de ventas de redes, CRM y anticipos 50/50' },
  'server/services/printSheetService.js': { max: 450, reason: 'Gestor cohesivo de pliegos diarios y ciclo de vida de taller' },
  'server/services/commissionService.js': { max: 450, reason: 'Motor financiero transaccional de liquidaciones y cálculo del 20%' },
  'server/controllers/remoteSaleController.js': { max: 350, reason: 'Controlador integral de clientes y ventas remotas' },
  'server/controllers/printSheetController.js': { max: 300, reason: 'Controlador de pliegos de taller y asignación' },
  'server/controllers/commissionController.js': { max: 300, reason: 'Controlador de comisiones y liquidaciones' },
  'server/controllers/saleController.js': { max: 400, reason: 'Controlador de ventas feriales, arqueos y logística de pedidos' },
};

// 🛡️ Techos Idiomáticos por Capa Arquitectónica (Erradicación Definitiva del Dogma de las 200 Líneas)
// Basados en los límites reales y margen de crecimiento saludable del repositorio:
const LAYER_DEFAULT_CEILINGS = {
  semantic: 800,      // Diccionarios declarativos, regex y gramáticas (server/services/semantic/)
  services: 500,      // Servicios de dominio transaccional ACID en Node.js (server/services/)
  routes: 500,        // Manifiestos centrales de enrutamiento (server/routes/)
  controllers: 350,   // Controladores HTTP y orquestación REST (server/controllers/)
  hooks: 350,         // Hooks de estado complejo, SSE streams y contextos (src/**/hooks/, src/context/)
  validators: 250,    // Esquemas declarativos Zod (server/validators/)
  components: 280,    // Componentes de interfaz de usuario en React (src/components/)
  default: 350,       // Techo general por defecto
};

function getLayerDefaultCeiling(relativePath) {
  if (relativePath.startsWith('server/services/semantic/')) return LAYER_DEFAULT_CEILINGS.semantic;
  if (relativePath.startsWith('server/services/')) return LAYER_DEFAULT_CEILINGS.services;
  if (relativePath.startsWith('server/controllers/')) return LAYER_DEFAULT_CEILINGS.controllers;
  if (relativePath.startsWith('server/routes/')) return LAYER_DEFAULT_CEILINGS.routes;
  if (relativePath.startsWith('server/validators/')) return LAYER_DEFAULT_CEILINGS.validators;
  if (relativePath.includes('/hooks/') || relativePath.startsWith('src/context/')) return LAYER_DEFAULT_CEILINGS.hooks;
  if (relativePath.startsWith('src/components/')) return LAYER_DEFAULT_CEILINGS.components;
  return LAYER_DEFAULT_CEILINGS.default;
}

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
  const layerDefault = getLayerDefaultCeiling(relativePath);
  const maxAllowed = domainRule ? domainRule.max : layerDefault;

  if (lineCount > maxAllowed) {
    oversizedFiles.push({
      path: relativePath,
      lines: lineCount,
      maxAllowed,
      excess: lineCount - maxAllowed,
      reason: domainRule?.reason || null,
    });
  } else if (domainRule && lineCount >= 150) {
    cohesiveFiles.push({
      path: relativePath,
      lines: lineCount,
      maxAllowed,
      headroom: maxAllowed - lineCount,
      reason: domainRule.reason,
    });
  }
}

// 🟢 Reporte de Cohesión Autorizada
if (cohesiveFiles.length > 0) {
  console.info(`\n🟢 Archivos con Cohesión Autorizada (con holgura de crecimiento):`);
  cohesiveFiles.sort((a, b) => b.lines - a.lines);
  cohesiveFiles.forEach((item) => {
    console.info(`  ✅ ${item.path} (${item.lines}/${item.maxAllowed} líneas | margen: +${item.headroom} líneas) — ${item.reason}`);
  });
}

// 🍝 Detección Proactiva de Código Ravioli (Micro-archivos artificiales en servicios)
const microServiceFiles = allFiles.filter((filePath) => {
  const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
  if (!rel.startsWith('server/services/')) return false;
  // Excluir generadores pequeños legítimos o adaptadores
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').length;
  return lines < 40 && !rel.endsWith('index.js');
});

if (microServiceFiles.length > 0) {
  console.info(`\n🍝 Alerta Informativa Anti-Ravioli (Archivos de servicio <40 líneas):`);
  microServiceFiles.forEach((filePath) => {
    const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').length;
    console.info(`  ℹ️ ${rel} (${lines} líneas) — Verificar que no sea una micro-fragmentación de un dominio cohesivo`);
  });
}

// 📊 Deuda Monolítica Real
console.info(`\n📊 Deuda Monolítica Real en STAND {IA} (archivos que exceden su límite):`);
if (oversizedFiles.length === 0) {
  console.info(`  ✨ ¡Excelente! Cero archivos exceden sus límites arquitectónicos.`);
} else {
  oversizedFiles.sort((a, b) => b.lines - a.lines);
  oversizedFiles.forEach((item) => {
    const badge = item.lines > item.maxAllowed * 1.75 || item.lines > 500 ? '🚨 CRÍTICO' : '⚠️ EXCEDIDO';
    console.info(`  ${badge}: ${item.path} (${item.lines} líneas | límite: ${item.maxAllowed}) [exceso: +${item.excess}]`);
  });

  console.info(`\n🛡️ [ARNÉS STAND IA] DIRECTIVA ARQUITECTÓNICA ANTI-RAVIOLI (LEER ANTES DE REFACTORIZAR):`);
  console.info(`  1. ¿Este archivo encapsula un dominio transaccional cohesivo (ej. servicios de venta, máquinas de estado)?`);
  console.info(`     👉 SÍ: QUEDA TERMINANTEMENTE PROHIBIDO fragmentarlo en micro-archivos artificiales ('código ravioli').`);
  console.info(`     👉 ACCIÓN CORRECTA: Registra el archivo con su justificación técnica en DOMAIN_CEILINGS de este script.`);
  console.info(`  2. ¿Este archivo mezcla capas incompatibles (ej. UI con queries SQL, formato HTML en modelos) o acoplamiento circular?`);
  console.info(`     👉 SÍ: Solo en este caso procede a desacoplar capas respetando la cohesión de dominio.`);
}

console.info(`\n💡 Total archivos que exceden su límite: ${oversizedFiles.length}`);
if (oversizedFiles.length > 0) {
  console.info(`🛡️ [ARNÉS STAND IA] Si los archivos son cohesivos por dominio, autoriza su techo en DOMAIN_CEILINGS; de lo contrario, desacopla capas.\n`);
}

process.exit(0);
