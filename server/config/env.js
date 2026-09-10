import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string({
    required_error: 'DATABASE_URL es obligatoria para conectar a la base de datos PostgreSQL dedicada.',
  }).min(1, 'DATABASE_URL no puede estar vacía'),
  JWT_SECRET: z.string({
    required_error: 'JWT_SECRET es obligatorio para la firma criptográfica de tokens de sesión.',
  }).min(16, 'JWT_SECRET debe tener al menos 16 caracteres de seguridad'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string({
    required_error: 'GOOGLE_CLIENT_ID es obligatorio para la autenticación GIS OAuth 2.0.',
  }).min(1, 'GOOGLE_CLIENT_ID no puede estar vacío'),
  SUPER_ADMIN_EMAILS: z.string({
    required_error: 'SUPER_ADMIN_EMAILS es obligatoria para autorizar a los Super Administradores en Dokploy.',
  })
    .min(1, 'SUPER_ADMIN_EMAILS no puede estar vacía')
    .transform((val) =>
      val
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    )
    .refine((emails) => emails.length > 0, {
      message: 'SUPER_ADMIN_EMAILS debe contener al menos un correo electrónico válido.',
    }),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GCS_BUCKET_NAME: z.string().default('deko-eventsales-media'),
  GCS_CREDENTIALS_BASE64: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
  DEFAULT_TENANT_NAME: z.string().default('Deco Vintage Guate'),
  DEFAULT_CURRENCY: z.string().default('GTQ'),
  DEFAULT_CURRENCY_SYMBOL: z.string().default('Q'),
  WEB_CATALOG_URL: z.string().default('https://decovintage.online'),
});

const rawEnv = {
  ...process.env,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID,
};

const parsedEnv = envSchema.safeParse(rawEnv);

const isTest = 
  process.env.NODE_ENV === 'test' || 
  process.execArgv.includes('--test') ||
  process.argv.some(arg => arg.includes('test')) ||
  Boolean(process.env.NODE_TEST_CONTEXT);

if (!parsedEnv.success) {
  if (!isTest) {
    console.error('\n' + '='.repeat(70));
    console.error('🚨 [FATAL ERROR: CONFIGURACIÓN DE ENTORNO INVÁLIDA O INCOMPLETA]');
    console.error('El servidor no puede iniciar debido a errores en las variables de entorno:');
    parsedEnv.error.issues.forEach((issue) => {
      console.error(`  ❌ [${issue.path.join('.') || 'GLOBAL'}]: ${issue.message}`);
    });
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }
}

export const ENV = parsedEnv.success ? parsedEnv.data : {};

// 🛡️ REGLA PERMANENTE: CANDADO DE AISLAMIENTO ESTRICTO DE INFRAESTRUCTURA
const FORBIDDEN_PATTERNS = ['145.223.120.56', 'catalog_db', 'admin_deco'];
if (ENV.DATABASE_URL && FORBIDDEN_PATTERNS.some((forbidden) => ENV.DATABASE_URL.includes(forbidden))) {
  if (!isTest) {
    console.error('\n' + '='.repeat(70));
    console.error('🚨 [FATAL ERROR: VIOLACIÓN DE AISLAMIENTO ESTRICTO DE PROYECTOS]');
    console.error('Se detectó un intento de conectar a infraestructura ajena no autorizada:');
    console.error('IPs o credenciales del proyecto web (145.223.120.56 / catalog_db) están estrictamente prohibidas.');
    console.error('Este módulo de ventas debe operar EXCLUSIVAMENTE en su propio servicio de Dokploy.');
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }
}

if (!ENV.GEMINI_API_KEY && !isTest) {
  console.warn('⚠️ [Config Advertencia] GEMINI_API_KEY no está definida. Las funciones de IA multimodal operarán en modo heurístico/simulado.');
}
