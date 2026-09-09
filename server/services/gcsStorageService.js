import { getGCSClient } from '../config/gcs.js';
import { ENV } from '../config/env.js';
import path from 'path';
import crypto from 'crypto';

/**
 * Sube un buffer a Google Cloud Storage de forma permanente y sin estado efímero.
 * Erradica cualquier fallback silencioso a disco local (cero escritura en public/uploads).
 *
 * @param {Object|Buffer} param1 - Objeto con { buffer, originalname, mimetype, folder } o directamente el Buffer
 * @param {string} [param2='file'] - originalname si se invoca con argumentos posicionales
 * @param {string} [param3='sales'] - folder si se invoca con argumentos posicionales
 * @returns {Promise<{ success: boolean, url: string, filename: string }>}
 */
export async function uploadBufferToStorage(param1, param2 = 'file', param3 = 'sales') {
  let buffer;
  let originalname = 'file';
  let mimetype = 'application/octet-stream';
  let folder = 'sales';

  if (Buffer.isBuffer(param1)) {
    buffer = param1;
    originalname = param2 || 'file';
    folder = param3 || 'sales';
  } else if (param1 && typeof param1 === 'object') {
    buffer = param1.buffer;
    originalname = param1.originalname || 'file';
    mimetype = param1.mimetype || 'application/octet-stream';
    folder = param1.folder || 'sales';
  } else {
    throw new Error('[GCS Storage] Parámetros inválidos: se requiere un Buffer o un objeto con buffer.');
  }

  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('[GCS Storage] Buffer inválido o no proporcionado.');
  }

  const gcs = getGCSClient();
  const bucketName = ENV.GCS_BUCKET_NAME || 'deko-eventsales-media';

  if (!gcs) {
    const errorMsg = '[GCS Storage] Error crítico: Cliente GCS no está configurado o no tiene credenciales válidas.';
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  if (!bucketName) {
    const errorMsg = '[GCS Storage] Error de configuración: GCS_BUCKET_NAME no está definido.';
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const ext = path.extname(originalname) || '.bin';
  const randomHex = crypto.randomBytes(8).toString('hex');
  const filename = `${folder}/${Date.now()}-${randomHex}${ext}`;

  try {
    const bucket = gcs.bucket(bucketName);
    const file = bucket.file(filename);

    await file.save(buffer, {
      metadata: { contentType: mimetype },
      resumable: false,
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${filename}`;
    return { success: true, url: publicUrl, filename };
  } catch (err) {
    console.error(`[GCS Storage] ❌ Error subiendo archivo a gs://${bucketName}/${filename}:`, err.message);
    throw new Error(`[GCS Storage] Fallo al subir a Google Cloud Storage: ${err.message}`);
  }
}
