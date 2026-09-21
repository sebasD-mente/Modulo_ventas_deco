import express from 'express';
import { authMiddleware, requireRole, requireEventAccess } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { createSaleSchema, cashClosingSchema, updateSaleSchema } from '../validators/saleValidators.js';
import { customerSchema, createRemoteSaleSchema, balancePaymentSchema } from '../validators/remoteSaleValidators.js';
import { createPrintSheetSchema, assignItemsToSheetSchema, updateSheetStatusSchema } from '../validators/printSheetValidators.js';
import { settleCommissionSchema, paySettlementSchema } from '../validators/commissionValidators.js';
import {
  getPendingCommissions,
  settleCommissions,
  listSettlements,
  getSettlement,
  markPaid,
} from '../controllers/commissionController.js';
import {
  getCustomers,
  createCustomer,
  getCustomer360,
  createRemoteSale,
  registerBalancePayment,
  uploadCustomArt,
} from '../controllers/remoteSaleController.js';
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
  listPrintSheets,
  getPrintSheet,
  createPrintSheet,
  assignItems,
  updateStatus as updatePrintSheetStatus,
} from '../controllers/printSheetController.js';
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
  purgeEventSales,
} from '../controllers/saleController.js';
import {
  getActiveEvent,
  getEventsList,
  activateEvent,
  createEvent,
  archiveEvent,
  unarchiveEvent,
  deleteEvent,
} from '../controllers/eventController.js';
import {
  getProducts,
  searchWebPostersCatalog,
  triggerCatalogSync,
} from '../controllers/catalogController.js';

import {
  handleVoiceSale,
  handleBatchPhoto,
  handleChatQuery,
  handleGetSession,
  handleClearDraft,
  handleArtworkRecognition,
  handleVideoRecognition,
} from '../controllers/aiController.js';

import { handleCatalogWebhook } from '../controllers/catalogWebhookController.js';

const router = express.Router();
const authenticate = authMiddleware;
const authorize = requireRole;

// ==========================================
// 1. RUTAS PÚBLICAS (AUTENTICACIÓN Y WEBHOOKS)
// ==========================================
router.get('/auth/config', getAuthConfig);
router.post('/auth/google', handleGoogleLogin);
router.post('/catalog/webhook', handleCatalogWebhook);

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
router.get(
  '/production/print-sheets',
  requireRole(['SUPER_ADMIN', 'OPERARIO_1', 'OPERARIO_2']),
  listPrintSheets
);
router.post(
  '/production/print-sheets',
  requireRole(['SUPER_ADMIN', 'OPERARIO_1', 'OPERARIO_2']),
  validate(createPrintSheetSchema),
  createPrintSheet
);
router.get(
  '/production/print-sheets/:id',
  requireRole(['SUPER_ADMIN', 'OPERARIO_1', 'OPERARIO_2']),
  getPrintSheet
);
router.post(
  '/production/print-sheets/:id/items',
  requireRole(['SUPER_ADMIN', 'OPERARIO_1', 'OPERARIO_2']),
  validate(assignItemsToSheetSchema),
  assignItems
);
router.patch(
  '/production/print-sheets/:id/status',
  requireRole(['SUPER_ADMIN', 'OPERARIO_1', 'OPERARIO_2']),
  validate(updateSheetStatusSchema),
  updatePrintSheetStatus
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
router.patch('/events/:id/archive', requireRole(['SUPER_ADMIN']), archiveEvent);
router.patch('/events/:id/unarchive', requireRole(['SUPER_ADMIN']), unarchiveEvent);
router.delete('/events/:id', requireRole(['SUPER_ADMIN']), deleteEvent);
router.get('/products', getProducts);

router.get('/catalog/web-posters', searchWebPostersCatalog);
router.post('/catalog/sync', requireRole(['SUPER_ADMIN']), triggerCatalogSync);

// ==========================================
// 6. RUTAS DE VENTAS, CRM Y MÉTRICAS
// ==========================================
router.get(
  '/customers',
  requireRole(['SUPER_ADMIN', 'VENDEDOR', 'VENDEDOR_REDES']),
  getCustomers
);
router.post(
  '/customers',
  requireRole(['SUPER_ADMIN', 'VENDEDOR', 'VENDEDOR_REDES']),
  validate(customerSchema),
  createCustomer
);
router.get(
  '/customers/:id',
  requireRole(['SUPER_ADMIN', 'VENDEDOR', 'VENDEDOR_REDES']),
  getCustomer360
);
router.post(
  '/sales/upload-art',
  requireRole(['SUPER_ADMIN', 'VENDEDOR', 'VENDEDOR_REDES']),
  upload.single('image'),
  uploadCustomArt
);
router.post(
  '/sales/remote',
  requireRole(['SUPER_ADMIN', 'VENDEDOR', 'VENDEDOR_REDES']),
  validate(createRemoteSaleSchema),
  createRemoteSale
);
router.post(
  '/sales/:id/balance-payment',
  requireRole(['SUPER_ADMIN', 'VENDEDOR', 'VENDEDOR_REDES']),
  validate(balancePaymentSchema),
  registerBalancePayment
);
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
  requireEventAccess,
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
router.post(
  '/sales/purge-test-sales',
  requireRole(['SUPER_ADMIN']),
  purgeEventSales
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
// 8. RUTAS DE LIQUIDACIONES Y COMISIONES (DOMINIO 3)
// ==========================================
router.get('/commissions/pending', authenticate, authorize(['SUPER_ADMIN', 'VENDEDOR_REDES']), getPendingCommissions);
router.post('/commissions/settle', authenticate, authorize(['SUPER_ADMIN']), validate(settleCommissionSchema), settleCommissions);
router.get('/commissions/settlements', authenticate, authorize(['SUPER_ADMIN', 'VENDEDOR_REDES']), listSettlements);
router.get('/commissions/settlements/:id', authenticate, authorize(['SUPER_ADMIN', 'VENDEDOR_REDES']), getSettlement);
router.patch('/commissions/settlements/:id/pay', authenticate, authorize(['SUPER_ADMIN']), validate(paySettlementSchema), markPaid);

// ==========================================
// 9. RUTAS DE INTELIGENCIA ARTIFICIAL MULTIMODAL
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
router.get(
  '/ai/session/:sessionId',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  handleGetSession
);
router.delete(
  '/ai/session/:sessionId/draft',
  requireRole(['SUPER_ADMIN', 'VENDEDOR']),
  handleClearDraft
);

// ==========================================
// 10. MANEJADOR DE ERRORES DE SUBIDA (MULTER) Y VALIDACIÓN
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
