/**
 * Fachada Canónica de Parser Semántico y Extractor de Métodos de Pago - STAND {IA}
 * Re-exporta los submódulos especializados preservando retrocompatibilidad total.
 */
export {
  normalizeSemanticText,
  PAYMENT_PATTERNS,
  extractPaymentMethod,
  NUMBER_WORDS,
  extractQuantity,
  extractSizeIdFromSegment,
  SIZE_STANDARD_PRICES,
  parseStandIntent,
} from './semantic/paymentExtractor.js';

export {
  STAND_ENTITY_ALIASES,
  resolveEntityAlias,
  normalizeArtworkQuery,
} from './semantic/entityAliases.js';
