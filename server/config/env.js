import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const ENV = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_secret_deko_eventsales_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'deko-eventsales-media',
  GCS_CREDENTIALS_BASE64: process.env.GCS_CREDENTIALS_BASE64,
  GCS_PROJECT_ID: process.env.GCS_PROJECT_ID,
  DEFAULT_TENANT_NAME: process.env.DEFAULT_TENANT_NAME || 'Deco Vintage Guate',
  DEFAULT_CURRENCY: process.env.DEFAULT_CURRENCY || 'GTQ',
  DEFAULT_CURRENCY_SYMBOL: process.env.DEFAULT_CURRENCY_SYMBOL || 'Q',
  WEB_CATALOG_URL: process.env.WEB_CATALOG_URL || 'https://decovintage.online',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
  SUPER_ADMIN_EMAILS: (process.env.SUPER_ADMIN_EMAILS || 'ia@dekolabs.org')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};

// 🛡️ REGLA PERMANENTE: CANDADO DE AISLAMIENTO ESTRICTO DE INFRAESTRUCTURA
const FORBIDDEN_PATTERNS = ['145.223.120.56', 'catalog_db', 'admin_deco'];
if (ENV.DATABASE_URL && FORBIDDEN_PATTERNS.some(forbidden => ENV.DATABASE_URL.includes(forbidden))) {
  console.error('\n' + '='.repeat(70));
  console.error('🚨 [FATAL ERROR: VIOLACIÓN DE AISLAMIENTO ESTRICTO DE PROYECTOS]');
  console.error('Se detectó un intento de conectar a infraestructura ajena no autorizada:');
  console.error('IPs o credenciales del proyecto web (145.223.120.56 / catalog_db) están estrictamente prohibidas.');
  console.error('Este módulo de ventas debe operar EXCLUSIVAMENTE en su propio servicio de Dokploy.');
  console.error('='.repeat(70) + '\n');
  process.exit(1);
}

// Validación de variables críticas para fail-fast
if (!ENV.DATABASE_URL) {
  console.warn('⚠️ [Config Advertencia] DATABASE_URL no está definida en .env. Las operaciones de base de datos fallarán hasta configurarse.');
}

if (!ENV.GEMINI_API_KEY) {
  console.warn('⚠️ [Config Advertencia] GEMINI_API_KEY no está definida. Las funciones de IA multimodal operarán en modo heurístico/simulado.');
}
