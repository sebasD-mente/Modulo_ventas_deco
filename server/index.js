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

// Seguridad y optimizaciones
app.use(helmet({
  contentSecurityPolicy: false, // Permitir Vite en desarrollo y multimedia
}));
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

  // Auto-sincronización en segundo plano si la base de datos no tiene el catálogo completo
  prisma.product
    .count({ where: { isActive: true } })
    .then(async (count) => {
      if (count < 20) {
        console.log(`[Startup] Catálogo local con solo ${count} productos. Iniciando sincronización de 233 pósters...`);
        await syncCatalogFromWeb().catch((e) =>
          console.warn('[Startup] Fallo no crítico en auto-sincronización:', e.message)
        );
      } else {
        console.log(`[Startup] Catálogo oficial verificado: ${count} productos activos en base de datos.`);
      }
    })
    .catch((err) => console.warn('[Startup] No se pudo verificar conteo de productos:', err.message));
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

