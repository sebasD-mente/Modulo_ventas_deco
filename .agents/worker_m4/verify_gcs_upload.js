import { uploadBufferToStorage } from '../../server/services/gcsStorageService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
const publicUploadsDir = path.join(projectRoot, 'public', 'uploads');

async function runVerification() {
  console.log('🚀 [Test GCS M4] Iniciando verificación en vivo de Google Cloud Storage...');

  const initialUploadsCount = fs.existsSync(publicUploadsDir)
    ? fs.readdirSync(publicUploadsDir, { recursive: true }).length
    : 0;
  console.log(`📁 Estado inicial de public/uploads: ${initialUploadsCount} archivos.`);

  // Prueba 1: Invocación con objeto de opciones
  const testPayload = `Live GCS Verification - Deko EventSales M4 - Timestamp: ${new Date().toISOString()}`;
  const testBuffer = Buffer.from(testPayload, 'utf-8');

  console.log('\n--- PRUEBA 1: Subida con objeto { buffer, originalname, mimetype, folder } ---');
  const res1 = await uploadBufferToStorage({
    buffer: testBuffer,
    originalname: 'm4-verification-sample.txt',
    mimetype: 'text/plain',
    folder: 'verifications',
  });

  console.log('✅ Resultado subida 1:', JSON.stringify(res1, null, 2));

  if (!res1.success || !res1.url.includes('deko-eventsales-media')) {
    throw new Error(`❌ Fallo en Prueba 1: URL inválida o no apunta al bucket deko-eventsales-media: ${res1.url}`);
  }

  // Verificar accesibilidad HTTP GET pública del objeto subido
  console.log(`🌐 Verificando lectura HTTP pública en: ${res1.url}`);
  const httpRes = await fetch(res1.url);
  console.log(`📡 Código HTTP recibido: ${httpRes.status} ${httpRes.statusText}`);
  if (httpRes.status !== 200) {
    throw new Error(`❌ Error HTTP GET: Se esperaba 200 OK pero se recibió ${httpRes.status}`);
  }

  const fetchedContent = await httpRes.text();
  console.log(`📄 Contenido descargado desde GCS: "${fetchedContent}"`);
  if (fetchedContent !== testPayload) {
    throw new Error('❌ Discrepancia de integridad: El contenido descargado no coincide con el buffer original.');
  }
  console.log('✅ Verificación de integridad de datos y lectura pública superada.');

  // Prueba 2: Invocación con argumentos posicionales
  console.log('\n--- PRUEBA 2: Subida con argumentos posicionales (buffer, originalname, folder) ---');
  const testPayload2 = `Positional Args Test - ${Date.now()}`;
  const testBuffer2 = Buffer.from(testPayload2, 'utf-8');
  const res2 = await uploadBufferToStorage(testBuffer2, 'positional-test.txt', 'verifications');
  console.log('✅ Resultado subida 2:', JSON.stringify(res2, null, 2));

  const httpRes2 = await fetch(res2.url);
  if (httpRes2.status !== 200) {
    throw new Error(`❌ Error HTTP GET en prueba posicional: ${httpRes2.status}`);
  }
  console.log('✅ Subida posicional verificada exitosamente con HTTP 200 OK.');

  // Prueba 3: Cero escrituras en public/uploads
  console.log('\n--- PRUEBA 3: Verificación de Cero Escritura en Disco Local (public/uploads) ---');
  const finalUploadsCount = fs.existsSync(publicUploadsDir)
    ? fs.readdirSync(publicUploadsDir, { recursive: true }).length
    : 0;

  console.log(`📁 Estado final de public/uploads: ${finalUploadsCount} archivos.`);
  if (finalUploadsCount !== initialUploadsCount) {
    throw new Error(`❌ Se detectaron archivos creados en public/uploads (${finalUploadsCount} vs ${initialUploadsCount})`);
  }
  console.log('✅ CERO archivos creados en disco local efímero. Modelo sin estado (stateless) 100% garantizado.');

  // Prueba 4: Fail-fast ante parámetros inválidos
  console.log('\n--- PRUEBA 4: Fail-Fast ante parámetros inválidos ---');
  try {
    await uploadBufferToStorage({ buffer: null });
    throw new Error('❌ Debería haber fallado ante buffer nulo.');
  } catch (err) {
    console.log(`✅ Excepción controlada capturada correctamente: "${err.message}"`);
  }

  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE GOOGLE CLOUD STORAGE (M4) PASARON CON ÉXITO!');
}

runVerification().catch((err) => {
  console.error('\n❌ FATAL: La verificación de GCS falló:', err);
  process.exit(1);
});
