import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ENV } from './config/env.js';
import apiRoutes from './routes/apiRoutes.js';
import { prisma } from './config/prisma.js';
import { syncCatalogFromWeb } from './services/catalogSyncService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Seguridad y optimizaciones con soporte para popups de Google OAuth 2.0 (COOP / GSI)
app.use(
  helmet({
    contentSecurityPolicy: false, // Permitir Vite y multimedia
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Requerido para accounts.google.com/gsi/transform
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(compression());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Servir archivos estáticos locales de uploads
app.use('/uploads', express.static(path.resolve(__dirname, '../public/uploads')));

// Health check endpoint con verificación en vivo de base de datos
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      db: 'connected',
      time: new Date().toISOString(),
      uptime: process.uptime(),
      env: ENV.NODE_ENV,
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      db: 'disconnected',
      error: err.message,
      time: new Date().toISOString(),
      uptime: process.uptime(),
      env: ENV.NODE_ENV,
    });
  }
});

// Rutas de API
app.use('/api', apiRoutes);

// Servir la app construida con Vite si existe dist/
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback para Express 5 (excluyendo /api, /uploads y /health)
  app.use((req, res) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      req.path === '/health' ||
      req.path.startsWith('/health/')
    ) {
      return res.status(404).json({ success: false, error: 'Endpoint no encontrado' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return res.status(404).json({ success: false, error: 'Endpoint no encontrado' });
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = app.listen(ENV.PORT, () => {
  console.log(`
🚀 Deko EventSales Server activo
📍 Puerto: http://localhost:${ENV.PORT}
🌍 Entorno: ${ENV.NODE_ENV}
⚡ Motor IA: ${ENV.GEMINI_MODEL}
  `);

  // ── Sincronización de Catálogo Web ─────────────────────────────────────────
  // Se ejecuta siempre al arrancar (para capturar productos nuevos de la tienda)
  // y cada 6 horas de forma periódica para mantener el catálogo actualizado.
  const runCatalogSync = async (reason = 'startup') => {
    try {
      const localCount = await prisma.product.count({ where: { isActive: true } });
      console.log(`[CatalogSync] 🔄 Iniciando sync (${reason}). Productos locales: ${localCount}`);
      const result = await syncCatalogFromWeb();
      if (result.success) {
        console.log(`[CatalogSync] ✅ Sync completado (${reason}): ${result.count} productos en catálogo. Fuente: ${result.source}`);
      } else {
        console.warn(`[CatalogSync] ⚠️ Sync (${reason}) no disponible: ${result.warning || result.error}`);
      }
    } catch (e) {
      console.warn(`[CatalogSync] ⚠️ Fallo no crítico en sync (${reason}):`, e.message);
    }
  };

  // Siempre sincronizar al arrancar — captura cualquier producto nuevo en la tienda web
  runCatalogSync('startup');

  // Sync automático cada 6 horas para mantener el catálogo actualizado en ferias largas
  const CATALOG_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 horas
  setInterval(() => runCatalogSync('scheduled-6h'), CATALOG_SYNC_INTERVAL_MS).unref();
  // ── Fin Sincronización ──────────────────────────────────────────────────────


  // 🛡️ REGLA ZERO-TRUST: Verificación y reconciliación no destructiva de Super Administradores
  prisma.user
    .findMany({
      where: {
        email: {
          in: ENV.SUPER_ADMIN_EMAILS,
        },
      },
    })
    .then(async (admins) => {
      console.log(
        `[Startup Zero-Trust] 🛡️ Super Admins configurados en entorno: ${ENV.SUPER_ADMIN_EMAILS.length}. Registrados en base de datos: ${admins.length}.`
      );
      for (const admin of admins) {
        const currentRoles = Array.isArray(admin.roles) && admin.roles.length > 0 ? admin.roles : [admin.role || 'SUPER_ADMIN'];
        if (!currentRoles.includes('SUPER_ADMIN') || admin.role !== 'SUPER_ADMIN' || admin.status !== 'ACTIVO') {
          const updatedRoles = Array.from(new Set(['SUPER_ADMIN', ...currentRoles]));
          await prisma.user.update({
            where: { id: admin.id },
            data: {
              role: 'SUPER_ADMIN',
              roles: updatedRoles,
              status: 'ACTIVO',
            },
          });
          console.log(`[Startup Zero-Trust] 👑 Rol restaurado/verificado a SUPER_ADMIN para: ${admin.email}`);
        }
      }
    })
    .catch((err) => console.warn('[Startup Zero-Trust] Verificación inicial de administradores:', err.message));
});

// Cierre limpio (Graceful Shutdown) para evitar procesos zombis o sockets retenidos en Windows
const cleanShutdown = async (signal) => {
  console.log(`\n🛑 Recibida señal ${signal}. Cerrando servidor y liberando puerto ${ENV.PORT}...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('✅ Base de datos desconectada y puerto liberado.');
    } catch (err) {
      // Silenciar error en desconexión si ya estaba cerrado
    }
    process.exit(0);
  });

  // Timeout de seguridad de 3 segundos para forzar salida si hay sockets colgados
  setTimeout(() => {
    console.error('⚠️ Forzando cierre del proceso tras timeout...');
    process.exit(1);
  }, 3000).unref();
};

process.on('SIGTERM', () => cleanShutdown('SIGTERM'));
process.on('SIGINT', () => cleanShutdown('SIGINT'));

export default app;

