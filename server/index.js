import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ENV } from './config/env.js';
import apiRoutes from './routes/apiRoutes.js';

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), env: ENV.NODE_ENV });
});

// Rutas de API
app.use('/api', apiRoutes);

// Servir la app construida con Vite si existe dist/
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback para Express 5
  app.use((req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
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
});

// Cierre limpio (Graceful Shutdown) para evitar procesos zombis o sockets retenidos en Windows
const cleanShutdown = async (signal) => {
  console.log(`\n🛑 Recibida señal ${signal}. Cerrando servidor y liberando puerto ${ENV.PORT}...`);
  server.close(async () => {
    try {
      const { prisma } = await import('./config/prisma.js');
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

