/**
 * LLM Observability Service — Phase 3 / R3
 *
 * Records every Gemini API interaction into AuditLog:
 *  - Model used, token counts (in/out), latency (ms), estimated cost (USD)
 *  - Whether the AI draft was ultimately confirmed as a real sale
 *
 * Pricing reference (Gemini 2.5 Flash, as of 2025):
 *   Input  : $0.30 / 1M tokens  → $0.0000003 per token
 *   Output : $2.50 / 1M tokens  → $0.0000025 per token
 */

import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';

// Gemini pricing reference (USD per token — update when prices change)
export const PRICING = {
  'gemini-2.5-flash-lite': { inputPerToken: 0.0000001, outputPerToken: 0.0000004 },
  'gemini-2.5-flash':      { inputPerToken: 0.0000003, outputPerToken: 0.0000025 },
  'gemini-2.0-flash':      { inputPerToken: 0.0000001, outputPerToken: 0.0000004 },
  'gemini-1.5-flash':      { inputPerToken: 0.0000001, outputPerToken: 0.0000004 },
};

export function estimateCostUsd(model, tokensIn, tokensOut) {
  const sortedKeys = Object.keys(PRICING).sort((a, b) => b.length - a.length);
  const key = sortedKeys.find((k) => model && (model === k || model.startsWith(k))) || 'gemini-2.5-flash';
  const price = PRICING[key] || PRICING['gemini-2.5-flash'];
  const inputCost  = (tokensIn  || 0) * price.inputPerToken;
  const outputCost = (tokensOut || 0) * price.outputPerToken;
  return Number((inputCost + outputCost).toFixed(8));
}

/**
 * Records a single LLM interaction asynchronously (fire-and-forget, non-blocking).
 *
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {string|null} opts.userId        - Auth user ID (may be null for anonymous)
 * @param {string} opts.action             - Action label: 'AI_VOICE_SALE', 'AI_CHAT', 'AI_ARTWORK', etc.
 * @param {string} opts.model              - Gemini model string
 * @param {number} opts.tokensIn           - Prompt tokens consumed
 * @param {number} opts.tokensOut          - Completion tokens generated
 * @param {number} opts.latencyMs          - Wall-clock time for the Gemini call (ms)
 * @param {object} [opts.details]          - Arbitrary extra JSON (query, eventId, etc.)
 * @param {string|null} [opts.ipAddress]   - Requester IP
 * @param {boolean} [opts.fallbackActivated] - Whether model fallback was activated
 * @param {string} [opts.effectiveModel]   - The model actually used if fallback occurred
 * @param {string} [opts.initialModel]     - The primary model originally targeted
 */
export function recordLlmInteraction({
  tenantId,
  userId,
  action,
  model,
  tokensIn,
  tokensOut,
  latencyMs,
  details,
  ipAddress,
  fallbackActivated,
  effectiveModel,
  initialModel,
}) {
  const usedModel = effectiveModel || model || ENV.GEMINI_MODEL || 'gemini-2.5-flash';
  const costUsd = estimateCostUsd(usedModel, tokensIn, tokensOut);

  const mergedDetails = details ? { ...details } : {};
  if (fallbackActivated !== undefined) {
    mergedDetails.fallbackActivated = Boolean(fallbackActivated);
  }
  if (effectiveModel) {
    mergedDetails.effectiveModel = effectiveModel;
  }
  if (initialModel) {
    mergedDetails.initialModel = initialModel;
  }

  // Fire-and-forget: never blocks the HTTP response
  prisma.auditLog.create({
    data: {
      tenantId,
      userId: userId || null,
      action: action || 'AI_INTERACTION',
      entity: 'LLM',
      details: Object.keys(mergedDetails).length > 0 ? JSON.parse(JSON.stringify(mergedDetails)) : null,
      ipAddress: ipAddress || null,
      llmModel:    usedModel,
      llmTokensIn:  tokensIn  ? Math.round(tokensIn)  : null,
      llmTokensOut: tokensOut ? Math.round(tokensOut) : null,
      llmLatencyMs: latencyMs ? Math.round(latencyMs) : null,
      llmCostUsd:   costUsd,
      saleConfirmed: false, // updated later when sale is confirmed
    },
  }).catch((err) => {
    // Non-fatal: observability must never break the IA pipeline
    console.warn('[LLM Observability] ⚠️ Failed to persist AuditLog entry:', err.message);
  });
}

/**
 * Marks an existing AI audit entry as having led to a confirmed sale.
 * Called from saleService after successful createSaleTransaction.
 *
 * @param {string} auditLogId
 */
export function markSaleConfirmed(auditLogId) {
  if (!auditLogId) return;
  prisma.auditLog.update({
    where: { id: auditLogId },
    data:  { saleConfirmed: true },
  }).catch((err) => {
    console.warn('[LLM Observability] ⚠️ Failed to mark saleConfirmed:', err.message);
  });
}

/**
 * Convenience wrapper: wraps a Gemini API call with automatic timing + telemetry.
 *
 * @template T
 * @param {() => Promise<T>} fn         - The Gemini API call to execute
 * @param {object} meta                 - Metadata for the audit record
 * @returns {Promise<{ result: T, auditId: string|null, latencyMs: number }>}
 */
export async function withLlmObservability(fn, { tenantId, userId, action, details, ipAddress, model } = {}) {
  const t0 = Date.now();
  let result;
  try {
    result = await fn();
  } finally {
    const latencyMs = Date.now() - t0;

    // Try to extract token counts from the response if available
    const usageMeta = result?.usageMetadata || result?.response?.usageMetadata || {};
    const tokensIn  = usageMeta.promptTokenCount       || usageMeta.inputTokenCount  || null;
    const tokensOut = usageMeta.candidatesTokenCount   || usageMeta.outputTokenCount || null;

    recordLlmInteraction({
      tenantId,
      userId,
      action,
      model: model || ENV.GEMINI_MODEL || 'gemini-2.5-flash',
      tokensIn,
      tokensOut,
      latencyMs,
      details,
      ipAddress,
    });
  }
  return result;
}
