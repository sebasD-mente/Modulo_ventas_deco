import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { createSaleSchema, cashClosingSchema, updateSaleSchema } from '../validators/saleValidators.js';
import {
  createSale,
  updateSale,
  getEventSalesList,
  getEventLiveMetrics,
  getMonitorMetrics,
  postCashClosing,
  getCashClosingsList,
} from '../controllers/saleController.js';
import {
  getActiveEvent,
  getProducts,
  getEventsList,
  activateEvent,
  createEvent,
  searchWebPostersCatalog,
  triggerCatalogSync,
} from '../controllers/catalogController.js';
import {
  handleVoiceSale,
  handleBatchPhoto,
  handleChatQuery,
  handleArtworkRecognition,
  handleVideoRecognition,
} from '../controllers/aiController.js';

const router = express.Router();

// Middleware de autenticación global para la API
router.use(authMiddleware);

// Rutas de Catálogo y Eventos
router.get('/events/active', getActiveEvent);
router.get('/events', getEventsList);
router.post('/events', createEvent);
router.patch('/events/:id/activate', activateEvent);
router.get('/products', getProducts);
router.get('/catalog/web-posters', searchWebPostersCatalog);
router.post('/catalog/sync', triggerCatalogSync);

// Rutas de Ventas y Métricas
router.post('/sales', validate(createSaleSchema), createSale);
router.patch('/sales/:id', validate(updateSaleSchema), updateSale);
router.get('/sales/events/:eventId', getEventSalesList);
router.get('/sales/events/:eventId/metrics', getEventLiveMetrics);
router.get('/sales/monitor', getMonitorMetrics);

// Rutas de Cierres de Caja
router.post('/closings', validate(cashClosingSchema), postCashClosing);
router.get('/closings/events/:eventId', getCashClosingsList);

// Rutas de Inteligencia Artificial Multimodal (Gemini 3.8 Flash)
router.post('/ai/voice-sale', upload.single('audio'), handleVoiceSale);
router.post('/ai/batch-photo', upload.single('image'), handleBatchPhoto);
router.post('/ai/recognize-artwork', upload.single('image'), handleArtworkRecognition);
router.post('/ai/recognize-video', upload.single('video'), handleVideoRecognition);
router.post('/ai/chat', handleChatQuery);

export default router;
