/**
 * server/services/catalogSyncService.js
 * Fachada de retrocompatibilidad para sincronización de catálogo.
 * Soporta tenant slug deco-vintage-guate y enriquecimiento descTokens vía liveCatalogSyncService.
 */

export * from './catalog/catalogSizeResolver.js';
export * from './catalog/liveCatalogSyncService.js';
