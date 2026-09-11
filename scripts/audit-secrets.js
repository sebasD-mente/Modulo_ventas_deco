import fs from 'fs';
import path from 'path';

console.info('🔒 [ARNÉS STAND IA] Ejecutando Auditoría Zero-Trust de Secretos y Aislamiento...');

const rootDir = process.cwd();
const filesToScan = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'coverage', '.agents', 'tests', 'scripts'].includes(entry.name)) {
        scanDir(fullPath);
      }
    } else if (/\.(js|jsx|json)$/i.test(entry.name)) {
      filesToScan.push(fullPath);
    }
  }
}

scanDir(rootDir);

const leakPatterns = [
  { name: 'Google API Key Hardcodeada', regex: /AIza[0-9A-Za-z-_]{35}/ },
  { name: 'OpenAI Secret Key Hardcodeada', regex: /sk-[A-Za-z0-9]{32,}/ },
  { name: 'Token JWT Hardcodeado', regex: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]{30,}/ },
];

let leaksFound = 0;

for (const file of filesToScan) {
  // Omitir env.js donde está la lista negra de IPs
  if (file.includes('server/config/env.js') || file.includes('server\\config\\env.js')) continue;

  const content = fs.readFileSync(file, 'utf-8');
  for (const pattern of leakPatterns) {
    if (pattern.regex.test(content)) {
      console.error(`\n🚨 [ALERTA DE SEGURIDAD ZERO-TRUST]`);
      console.error(`  Fuga o violación detectada: ${pattern.name}`);
      console.error(`  Archivo comprometido: ${path.relative(rootDir, file)}`);
      leaksFound++;
    }
  }

  // Verificar que la IP ajena no esté en ningún archivo de código activo
  if (content.includes('145.223.120.56')) {
    console.error(`\n🚨 [ALERTA DE SEGURIDAD ZERO-TRUST]`);
    console.error(`  Se detectó referencia a la IP prohibida de infraestructura ajena: 145.223.120.56`);
    console.error(`  Archivo comprometido: ${path.relative(rootDir, file)}`);
    leaksFound++;
  }
}

if (leaksFound > 0) {
  console.error(`❌ Auditoría fallida: Se encontraron ${leaksFound} posibles fugas o violaciones de aislamiento.\n`);
  process.exit(1);
}

console.info(`✅ [ARNÉS STAND IA] Cero fugas o violaciones detectadas en ${filesToScan.length} archivos de producción.\n`);
process.exit(0);
