import fs from 'fs';
import path from 'path';

console.info('📏 [ARNÉS STAND IA] Auditando límites de tamaño y deuda monolítica...');

const rootDir = process.cwd();
const dirsToScan = ['src/components', 'server/services', 'server/controllers'];
const oversizedFiles = [];

for (const dir of dirsToScan) {
  const fullDir = path.join(rootDir, dir);
  if (!fs.existsSync(fullDir)) continue;

  const files = fs.readdirSync(fullDir).filter((f) => /\.(js|jsx)$/i.test(f));
  for (const file of files) {
    const filePath = path.join(fullDir, file);
    const lineCount = fs.readFileSync(filePath, 'utf-8').split('\n').length;
    if (lineCount > 200) {
      oversizedFiles.push({
        path: `${dir}/${file}`,
        lines: lineCount,
      });
    }
  }
}

console.info(`\n📊 Estado de Deuda Monolítica en STAND {IA}:`);
oversizedFiles.sort((a, b) => b.lines - a.lines);
oversizedFiles.forEach((item) => {
  const badge = item.lines > 1000 ? '🚨 CRÍTICO' : '⚠️ EXCEDIDO';
  console.info(`  ${badge}: ${item.path} (${item.lines} líneas)`);
});

console.info(`\n💡 Total archivos que requieren despiece modular: ${oversizedFiles.length}`);
console.info(`🛡️ [ARNÉS STAND IA] Alerta activa para Fred: Prohibido añadir más líneas a estos archivos.\n`);
process.exit(0);
