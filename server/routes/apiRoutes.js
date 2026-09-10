import express from 'express';
import { authMiddleware, requireRole, requireEventAccess } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { createSaleSchema, cashClosingSchema, updateSaleSchema } from '../validators/saleValidators.js';
import {
  handleGoogleLogin,
  getMe,
} from '../controllers/authController.js';
import {
  getProductionItems,
  updateProductionStatus,
  getProductionMetrics,
} from '../controllers/productionController.js';
import {
  getUsersList,
  updateUserRole,
  assignUserToEvent,
  toggleUserStatus,
} from '../controllers/userController.js';
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

// ==========================================
// 1. RUTAS PÚBLICAS DE AUTENTICACIÓN
// ==========================================
router.post('/auth/google', handleGoogleLogin);

// ==========================================
// 2. MIDDLEWARE GLOBAL DE AUTENTICACIÓN
// ==========================================
router.use(authMiddleware);

// Endpoint de sesión de usuario autenticado
router.get('/auth/me', getMe);

// ==========================================
// 3. RUTAS DE GESTIÓN DE PRODUCCIÓN (OPERARIO 1 & OPERARIO 2)
// ==========================================
router.get(
  '/production/items',
  requireRole(['SUPER_ADMIN', 'OPERARIO_1', 'OPERARIO_2']),
  getProductionItems
);
router.patch(
  '/production/items/:id/status',
  requireRole(['SUPER_ADMIN', 'OPERARIO_1', 'OPERARIO_2']),
  updateProductionStatus
);
router.get(
  '/production/metrics',
  requireRole(['SUPER_ADMIN', 'OPERARIO_1', 'OPERARIO_2']),
  getProductionMetrics
);

// ==========================================
// 4. RUTAS DE ADMINISTRACIÓN DE USUARIOS (SOLO SUPER_ADMIN)
// ==========================================
router.get('/users', requireRole(['SUPER_ADMIN']), getUsersList);
router.patch('/users/:id/role', requireRole(['SUPER_ADMIN']), updateUserRole);
router.patch('/users/:id/roles', requireRole(['SUPER_ADMIN']), updateUserRole);
router.patch('/users/:id/assign-event', requireRole(['SUPER_ADMIN']), assignUserToEvent);
router.patch('/users/:id/toggle-status', requireRole(['SUPER_ADMIN']), toggleUserStatus);

// ==========================================
// 5. RUTAS DE CATÁLOGO Y EVENTOS
// ==========================================
router.get('/events/active', getActiveEvent);
router.get('/events', getEventsList);
router.post('/events', requireRole(['SUPER_ADMIN']), createEvent);
router.patch('/events/:id/activate', requireRole(['SUPER_ADMIN']), activateEvent);
router.get('/products', getProducts);
router.get('/catalog/web-posters', searchWebPostersCatalog);
router.post('/catalog/sync', requireRole(['SUPER_ADMIN']), triggerCatalogSync);

// ==========================================
// 6. RUTAS DE VENTAS Y MÉTRICAS
// ==========================================
router.post(
  '/sales',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  requireEventAccess,
  validate(createSaleSchema),
  createSale
);
router.patch(
  '/sales/:id',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  validate(updateSaleSchema),
  updateSale
);
router.get('/sales/events/:eventId', getEventSalesList);
router.get('/sales/events/:eventId/metrics', getEventLiveMetrics);
router.get('/sales/monitor', getMonitorMetrics);

// ==========================================
// 7. RUTAS DE CIERRES DE CAJA
// ==========================================
router.post('/closings', requireRole(['SUPER_ADMIN', 'VENDEDOR']), validate(cashClosingSchema), postCashClosing);
router.get('/closings/events/:eventId', getCashClosingsList);

// ==========================================
// 8. RUTAS DE INTELIGENCIA ARTIFICIAL MULTIMODAL
// ==========================================
router.post('/ai/voice-sale', requireRole(['SUPER_ADMIN', 'VENDEDOR']), upload.single('audio'), handleVoiceSale);
router.post('/ai/batch-photo', requireRole(['SUPER_ADMIN', 'VENDEDOR']), upload.single('image'), handleBatchPhoto);
router.post('/ai/recognize-artwork', requireRole(['SUPER_ADMIN', 'VENDEDOR']), upload.single('image'), handleArtworkRecognition);
router.post('/ai/recognize-video', requireRole(['SUPER_ADMIN', 'VENDEDOR']), upload.single('video'), handleVideoRecognition);
router.post('/ai/chat', requireRole(['SUPER_ADMIN', 'VENDEDOR']), handleChatQuery);

export default router;
