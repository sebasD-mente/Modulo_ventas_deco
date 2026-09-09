import { Storage } from '@google-cloud/storage';
import { ENV } from './env.js';

let storageClient = null;

export function getGCSClient() {
  if (storageClient) return storageClient;

  const options = {};
  if (ENV.GCS_PROJECT_ID) {
    options.projectId = ENV.GCS_PROJECT_ID.trim();
  }

  if (ENV.GCS_CREDENTIALS_BASE64 && ENV.GCS_CREDENTIALS_BASE64.trim().length > 0) {
    try {
      const sanitized = ENV.GCS_CREDENTIALS_BASE64.trim().replace(/^['"]|['"]$/g, '');
      const jsonString = sanitized.startsWith('{')
        ? sanitized
        : Buffer.from(sanitized.replace(/\s+/g, ''), 'base64').toString('utf-8');

      const parsedCreds = JSON.parse(jsonString);
      if (parsedCreds.private_key && typeof parsedCreds.private_key === 'string') {
        parsedCreds.private_key = parsedCreds.private_key.replace(/\\n/g, '\n');
      }

      options.credentials = parsedCreds;
      if (parsedCreds.project_id && !options.projectId) {
        options.projectId = parsedCreds.project_id;
      }
      console.log(`[GCS Init] ✅ Cargadas credenciales desde GCS_CREDENTIALS_BASE64`);
    } catch (err) {
      console.error('[GCS Init Error] ❌ Error parseando GCS_CREDENTIALS_BASE64:', err.message);
    }
  }

  try {
    storageClient = new Storage(options);
    return storageClient;
  } catch (err) {
    console.warn('[GCS Init Warning] ⚠️ Cliente GCS inicializado en modo degradado o local:', err.message);
    return null;
  }
}
