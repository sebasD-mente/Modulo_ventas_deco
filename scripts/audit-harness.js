import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 🛡️ [DEKO LABS] COMPUERTA FÍSICA DE VERIFICACIÓN (HARNESS² EDITION)
 *
 * Verifica únicamente los candados físicos deterministas del proyecto:
 * 1. Cero secretos expuestos en texto plano (scripts/audit-secrets.js).
 * 2. Sintaxis válida del runtime (scripts/audit-syntax.js).
 * 3. Validación de catálogo de modelos de IA si aplica (scripts/verify-gemini-models.js).
 * 4. Pruebas unitarias y de seguridad reales del proyecto (npm run test:unit).
 * 5. Compilación real del frontend si aplica (npm run build).
 */

const startTime = Date.now();
const rootDir = process.cwd();
const args = process.argv.slice(2);
const skipUnit = args.includes('--skip-unit');

const results = {
  secrets: 'SKIPPED',
  syntax: 'SKIPPED',
  models: 'SKIPPED',
  security: 'SKIPPED',
  tests: 'SKIPPED',
  build: 'SKIPPED',
};

function runStep(name, cmd, cmdArgs = [], options = {}) {
  console.log(`▶️ Ejecutando: ${name}...`);
  const stepStart = Date.now();
  const isWin = process.platform === 'win32';
  const resolvedCmd = (isWin && cmd === 'npm') ? 'npm.cmd' : cmd;
  const useShell = options.shell !== undefined
    ? options.shell
    : (isWin && (cmd === 'npm' || (typeof resolvedCmd === 'string' && resolvedCmd.endsWith('.cmd'))));

  const res = spawnSync(resolvedCmd, cmdArgs, {
    stdio: 'inherit',
    encoding: 'utf-8',
    env: process.env,
    cwd: rootDir,
    shell: useShell,
  });

  const duration = ((Date.now() - stepStart) / 1000).toFixed(2);
  if (res.status !== 0) {
    console.error(`\n❌ [FALLO DE COMPUERTA] '${name}' falló tras ${duration}s.`);
    process.exit(1);
  }
  console.log(`✅ [OK] '${name}' (${duration}s).\n`);
}

if (fs.existsSync(path.join(rootDir, 'scripts', 'audit-secrets.js'))) {
  runStep('1. Auditoría de Secretos y Zero-Trust', process.execPath, ['scripts/audit-secrets.js']);
  results.secrets = 'PASS';
}

if (fs.existsSync(path.join(rootDir, 'scripts', 'audit-syntax.js'))) {
  runStep('2. Chequeo de Sintaxis (node --check)', process.execPath, ['scripts/audit-syntax.js']);
  results.syntax = 'PASS';
}

if (fs.existsSync(path.join(rootDir, 'scripts', 'verify-gemini-models.js'))) {
  runStep('3. Verificación de Modelos de IA', process.execPath, ['scripts/verify-gemini-models.js']);
  results.models = 'PASS';
}

const securityTestPath = path.join(rootDir, 'tests', 'security', 'zero-trust.test.js');
if (fs.existsSync(securityTestPath)) {
  runStep('4. Suite de Seguridad Zero-Trust', process.execPath, ['--test', 'tests/security/zero-trust.test.js']);
  results.security = 'PASS';
}

if (!skipUnit) {
  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  } catch (_) {}

  if (pkg.scripts && pkg.scripts['test:unit']) {
    runStep('5. Pruebas Unitarias (npm run test:unit)', 'npm', ['run', 'test:unit']);
    results.tests = 'PASS';
  } else {
    const candidateDirs = ['test', 'tests'];
    let testFiles = [];
    for (const cDir of candidateDirs) {
      const fullDir = path.join(rootDir, cDir);
      if (fs.existsSync(fullDir)) {
        const found = fs.readdirSync(fullDir)
          .filter((file) => file.endsWith('.test.js') && !file.includes('zero-trust'))
          .map((file) => path.join(cDir, file).replace(/\\/g, '/'));
        testFiles.push(...found);
      }
    }
    if (testFiles.length > 0) {
      runStep(`5. Pruebas Unitarias (${testFiles.length} suites)`, process.execPath, [
        '--test',
        '--test-concurrency=1',
        ...testFiles,
      ]);
      results.tests = 'PASS';
    }
  }
}

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  if (pkg.scripts && pkg.scripts.build && fs.existsSync(path.join(rootDir, 'src'))) {
    runStep('6. Compilación Frontend (npm run build)', 'npm', ['run', 'build']);
    results.build = 'PASS';
  }
} catch (_) {}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(JSON.stringify({
  status: 'HARNESS_PASS',
  framework: 'DEKO-HARNESS2-CORE',
  results,
  totalTimeSeconds: parseFloat(totalTime),
}, null, 2));
process.exit(0);
