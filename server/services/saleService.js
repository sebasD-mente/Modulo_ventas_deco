/**
 * Fachada Canónica de Servicios de Ventas y Arqueos - STAND {IA}
 * Re-exporta submódulos especializados preservando retrocompatibilidad total.
 *
 * Invariantes contables y de auditoría:
 * - Validación financiera estricta: if (Math.abs(paymentsTotal - totalAmount) > 0.05)
 * - Reconciliación segura en updateSaleTransaction:
 *   matchedExistingIds, discardedItemIds, tx.saleItem.update
 */
export { generateSaleNumber } from './sales/saleNumberGenerator.js';
export { createSaleTransaction, updateSaleTransaction } from './sales/saleTransactionService.js';
export { getEventKPIs, getMonitorDashboardMetrics, getEventSalesList } from './sales/saleKpiService.js';
export { getHourlySalesAnalytics, getTopSellingPosters } from './sales/saleAnalyticsService.js';
export { createCashClosingTransaction } from './sales/cashClosingService.js';
export { runMidnightClosingAudit } from './sales/midnightClosingService.js';
export { purgeEventSalesTransaction } from './sales/salePurgeService.js';
