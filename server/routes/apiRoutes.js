import express from 'express';
import { authMiddleware, requireRole, requireEventAccess } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { createSaleSchema, cashClosingSchema, updateSaleSchema } from '../validators/saleValidators.js';
import {
  handleGoogleLogin,
  getAuthConfig,
  getMe,
} from '../controllers/authController.js';
import {
  getProductionItems,
  updateProductionStatus,
  getProductionMetrics,
} from '../controllers/productionController.js';
import {
  getUsersList,
  createUser,
  deleteUser,
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
router.get('/auth/config', getAuthConfig);
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
router.post('/users', requireRole(['SUPER_ADMIN']), createUser);
router.delete('/users/:id', requireRole(['SUPER_ADMIN']), deleteUser);
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
router.get(
  '/sales/events/:eventId',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  requireEventAccess,
  getEventSalesList
);
router.get(
  '/sales/events/:eventId/metrics',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  requireEventAccess,
  getEventLiveMetrics
);
router.get(
  '/sales/monitor',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  getMonitorMetrics
);

// ==========================================
// 7. RUTAS DE CIERRES DE CAJA
// ==========================================
router.post(
  '/closings',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  requireEventAccess,
  validate(cashClosingSchema),
  postCashClosing
);
router.get(
  '/closings/events/:eventId',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  requireEventAccess,
  getCashClosingsList
);

// ==========================================
// 8. RUTAS DE INTELIGENCIA ARTIFICIAL MULTIMODAL
// ==========================================
router.post(
  '/ai/voice-sale',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  upload.single('audio'),
  requireEventAccess,
  handleVoiceSale
);
router.post(
  '/ai/batch-photo',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  upload.single('image'),
  requireEventAccess,
  handleBatchPhoto
);
router.post(
  '/ai/recognize-artwork',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  upload.single('image'),
  requireEventAccess,
  handleArtworkRecognition
);
router.post(
  '/ai/recognize-video',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  upload.single('video'),
  requireEventAccess,
  handleVideoRecognition
);
router.post(
  '/ai/chat',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  requireEventAccess,
  handleChatQuery
);

// ==========================================
// 9. MANEJADOR DE ERRORES DE SUBIDA (MULTER) Y VALIDACIÓN
// ==========================================
router.use((err, req, res, next) => {
  if (err?.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: `Error al procesar archivo: ${err.message}`,
      code: err.code,
    });
  }
  if (err?.code === 'UNSUPPORTED_MEDIA_TYPE' || err?.message?.includes('Tipo de archivo')) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  next(err);
});

export default router;
