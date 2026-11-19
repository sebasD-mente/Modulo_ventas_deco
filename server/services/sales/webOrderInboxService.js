import crypto from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { ENV } from '../../config/env.js';
import { resolveDefaultTenantId } from '../catalog/liveCatalogSyncService.js';
import { normalizeCatalogSizeId, SIZE_CATALOG_MAP } from '../catalog/catalogSizeResolver.js';

export function normalizeWebOrderNumber(raw) {
  if (!raw) return '';
  return String(raw).trim().replace(/^#+/, '').trim();
}

export function normalizeWebMaterial(raw) {
  const val = String(raw || 'mdf').trim().toUpperCase();
  if (val === 'PVC' || val === 'PVC_5MM') return 'PVC_5MM';
  if (val === 'VINYL_ONLY' || val === 'VINILO_SOLO' || val === 'VINILO') return 'VINILO_SOLO';
  return 'MDF_5_5MM';
}

export function toWebBaseMaterial(material) {
  const norm = normalizeWebMaterial(material);
  if (norm === 'PVC_5MM') return 'pvc';
  if (norm === 'VINILO_SOLO') return 'vinyl_only';
  return 'mdf';
}

export function parseDecimalDimension(raw) {
  if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return 0;
  const num = Number(String(raw).trim().replace(',', '.'));
  return Number.isFinite(num) && num > 0 ? Number(num.toFixed(2)) : 0;
}

export function resolveExpectedWebOrdersSecret(envOverride = null) {
  const src = envOverride || process.env;
  return String(
    src?.WEB_ORDERS_WEBHOOK_SECRET ||
    (!envOverride ? ENV.WEB_ORDERS_WEBHOOK_SECRET : '') ||
    src?.CATALOG_WEBHOOK_SECRET ||
    (!envOverride ? ENV.CATALOG_WEBHOOK_SECRET : '') ||
    ''
  ).trim();
}

export function getWebIntegrationCandidateUrls(envOverride = null) {
  const configured = (envOverride?.WEB_CATALOG_URL ?? process.env.WEB_CATALOG_URL ?? ENV.WEB_CATALOG_URL ?? '').trim();
  return [configured, 'https://decovintage.online']
    .filter((u, idx, arr) => u && !u.includes('decovintageguate.com') && arr.indexOf(u) === idx)
    .map((u) => u.replace(/\/+$/, ''));
}

export function normalizeWebImageUrl(rawUrl, baseOrigin = 'https://decovintage.online') {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const cleanOrigin = (baseOrigin || 'https://decovintage.online').replace(/\/+$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${cleanOrigin}${cleanPath}`;
}

export function isWebOrderWebhookAuthorized(req, { envOverride = null } = {}) {
  const headers = req?.headers || {};
  const authHeader = typeof headers.authorization === 'string' ? headers.authorization.trim() : '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const incomingSecret = String(
    headers['x-webhook-secret'] ||
    headers['x-web-orders-secret'] ||
    bearer ||
    ''
  ).trim();

  const expectedSecret = resolveExpectedWebOrdersSecret(envOverride);
  if (!incomingSecret || !expectedSecret) return false;

  const incomingBuf = Buffer.from(incomingSecret, 'utf8');
  const expectedBuf = Buffer.from(expectedSecret, 'utf8');
  if (incomingBuf.length !== expectedBuf.length || incomingBuf.length === 0) return false;
  return crypto.timingSafeEqual(incomingBuf, expectedBuf);
}

function computeFallbackCustomUnitPrice({ sizeMode, widthCm, heightCm, stdPrice, material }) {
  if (sizeMode === 'custom' && widthCm > 0 && heightCm > 0) {
    const area = Number((widthCm * heightCm).toFixed(2));
    const basePrint = area * 0.048;
    const raw = material === 'PVC_5MM' ? basePrint + 15 : material === 'VINILO_SOLO' ? basePrint * 0.5 : basePrint + 25;
    return Number(raw.toFixed(2));
  }
  const base = Number(stdPrice) || 65;
  const raw = material === 'PVC_5MM' ? base + 15 : material === 'VINILO_SOLO' ? base * 0.5 : base;
  return Number(raw.toFixed(2));
}

export function normalizeWebOrderItem(rawItem = {}, { baseOrigin = 'https://decovintage.online', productMapBySku = new Map(), index = 0 } = {}) {
  const widthCm = parseDecimalDimension(rawItem.customWidth);
  const heightCm = parseDecimalDimension(rawItem.customHeight);
  const hasCustomDims = widthCm > 0 && heightCm > 0;
  const sizeMode = (String(rawItem.sizeMode || '').toLowerCase() === 'custom' || hasCustomDims) ? 'custom' : 'standard';
  const material = normalizeWebMaterial(rawItem.material || rawItem.baseMaterial);
  const baseMaterial = toWebBaseMaterial(material);
  const isCustom = Boolean(rawItem.isCustom === true || sizeMode === 'custom');

  const posterId = rawItem.posterId != null ? String(rawItem.posterId).trim() : null;
  const legacyId = rawItem.legacyId != null ? String(rawItem.legacyId).trim() : null;
  const sku = (rawItem.sku && String(rawItem.sku).trim()) || (posterId ? `WEB-${posterId}` : (legacyId ? `WEB-${legacyId}` : null));
  const matchedProduct = sku ? productMapBySku.get(sku) : null;

  const stdInput = rawItem.selectedStandardSize && typeof rawItem.selectedStandardSize === 'object' ? rawItem.selectedStandardSize : {};
  const resolvedSizeId = sizeMode === 'custom'
    ? 'CUSTOM'
    : normalizeCatalogSizeId(rawItem.sizeId || stdInput.id || stdInput.sizeId || rawItem.sizeLabel || stdInput.name || 'MEDIANO');
  const catalogSize = SIZE_CATALOG_MAP[resolvedSizeId] || SIZE_CATALOG_MAP.MEDIANO;

  const rawTitle = String(rawItem.title || rawItem.titulo || matchedProduct?.name || (isCustom ? `Póster Personalizado #${index + 1}` : 'Póster Catálogo')).trim();
  const qty = Math.max(1, Math.min(500, Math.floor(Number(rawItem.quantity) || 1)));
  const imageUrl = normalizeWebImageUrl(rawItem.imageUrl || rawItem.customImageUrl || rawItem.thumbUrl || matchedProduct?.imageUrl || null, baseOrigin);
  const thumbUrl = normalizeWebImageUrl(rawItem.thumbUrl || rawItem.imageUrl || rawItem.customImageUrl || matchedProduct?.imageUrl || null, baseOrigin);

  let sizeLabel = String(rawItem.sizeLabel || '').trim();
  let customDimensions = null;
  let customArea = null;

  if (sizeMode === 'custom' && hasCustomDims) {
    const dimText = `${widthCm} x ${heightCm} cm`;
    sizeLabel = sizeLabel || dimText;
    customDimensions = `Especial: ${dimText} (Corte Taller)`;
    customArea = Number((widthCm * heightCm).toFixed(2));
  } else {
    const stdName = String(stdInput.name || stdInput.nombre || catalogSize.nombre).trim();
    const stdDims = String(stdInput.dimensions || stdInput.dimensiones || catalogSize.dimensiones).trim();
    sizeLabel = sizeLabel || `${stdName} (${stdDims})`;
    if (isCustom || material !== 'MDF_5_5MM') {
      customDimensions = `Estándar: ${stdName} (${stdDims})`;
    }
  }

  const providedUnit = Number(rawItem.unitPrice ?? stdInput.price ?? stdInput.precio ?? 0);
  const unitPrice = providedUnit > 0
    ? Number(providedUnit.toFixed(2))
    : computeFallbackCustomUnitPrice({ sizeMode, widthCm, heightCm, stdPrice: catalogSize.precio, material });
  const subtotal = Number((unitPrice * qty).toFixed(2));
  const customNote = rawItem.customNote ? String(rawItem.customNote).trim() : null;

  const description = isCustom
    ? `Personalizado: ${rawTitle}${customNote ? ` - ${customNote}` : ''} (${material}, ${customDimensions})`
    : material !== 'MDF_5_5MM'
      ? `${rawTitle} (${catalogSize.nombre} - ${material})`
      : `${rawTitle} (${catalogSize.nombre})`;

  return {
    isCustom: Boolean(isCustom || material !== 'MDF_5_5MM'),
    productId: (!isCustom && matchedProduct?.id) ? matchedProduct.id : null,
    posterId,
    legacyId,
    sku,
    title: rawTitle,
    description,
    sizeMode,
    sizeId: resolvedSizeId,
    sizeLabel,
    customDimensions,
    customWidth: hasCustomDims ? widthCm : null,
    customHeight: hasCustomDims ? heightCm : null,
    customArea,
    material,
    baseMaterial,
    quantity: qty,
    unitPrice,
    subtotal,
    imageUrl,
    thumbUrl,
    customImageUrl: (isCustom || material !== 'MDF_5_5MM') ? (imageUrl || thumbUrl) : null,
    customNote,
  };
}

export function normalizeWebOrderPayload(payload, { baseOrigin = 'https://decovintage.online', productMapBySku = new Map() } = {}) {
  const rawOrder = payload?.order && typeof payload.order === 'object' ? payload.order : payload;
  const orderNumber = normalizeWebOrderNumber(rawOrder?.orderNumber);
  if (!orderNumber) {
    const err = new Error('El código orderNumber del pedido web es obligatorio.');
    err.statusCode = 400;
    throw err;
  }

  const rawSource = String(rawOrder?.orderSource || 'WEB_CUSTOM').trim().toUpperCase();
  const orderSource = ['WEB_CART', 'WEB_CUSTOM', 'WEB_QUICK_POSTER'].includes(rawSource) ? rawSource : 'WEB_CUSTOM';

  const cust = rawOrder?.customer && typeof rawOrder.customer === 'object' ? rawOrder.customer : {};
  const customerName = String(cust.fullName || cust.name || rawOrder?.customerName || 'Cliente Web').trim() || 'Cliente Web';
  const rawPhone = String(cust.phone || rawOrder?.customerPhone || '').trim();
  const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
  const customerPhone = cleanDigits.length >= 8 ? cleanDigits : (rawPhone || null);
  const customerAddress = String(cust.address || cust.deliveryAddress || rawOrder?.customerAddress || '').trim() || null;
  const customerDepartment = String(cust.department || rawOrder?.customerDepartment || '').trim() || null;
  const customerNotes = String(cust.notes || rawOrder?.customerNotes || '').trim() || null;

  const rawItems = Array.isArray(rawOrder?.items) ? rawOrder.items : [];
  const items = rawItems.map((it, idx) => normalizeWebOrderItem(it, { baseOrigin, productMapBySku, index: idx }));
  const computedUnits = items.reduce((acc, it) => acc + it.quantity, 0);
  const computedTotal = Number(items.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2));
  const providedQuoted = Number(rawOrder?.quotedTotal ?? rawOrder?.totalPrice ?? 0);

  let webCreatedAt = null;
  if (rawOrder?.createdAt) {
    const parsedDate = new Date(rawOrder.createdAt);
    if (!Number.isNaN(parsedDate.getTime())) webCreatedAt = parsedDate;
  }

  return {
    externalOrderId: rawOrder?.externalOrderId || rawOrder?.id || null,
    orderNumber,
    orderSource,
    customerName,
    customerPhone,
    customerAddress,
    customerDepartment,
    customerNotes,
    totalUnits: Number(rawOrder?.totalUnits) > 0 ? Math.floor(Number(rawOrder.totalUnits)) : Math.max(1, computedUnits),
    quotedTotal: providedQuoted > 0 ? Number(providedQuoted.toFixed(2)) : computedTotal,
    items,
    webCreatedAt,
    rawPayload: rawOrder,
  };
}

async function findExistingInboxOrder(client, tenantId, orderNumber) {
  if (typeof client.webOrderInbox?.findUnique === 'function') {
    return await client.webOrderInbox.findUnique({ where: { tenantId_orderNumber: { tenantId, orderNumber } } });
  }
  if (typeof client.webOrderInbox?.findFirst === 'function') {
    return await client.webOrderInbox.findFirst({ where: { tenantId, orderNumber } });
  }
  return null;
}

export async function upsertWebOrderInboxRecord({ tenantId, payload, prismaClient = prisma, envOverride = null } = {}) {
  const targetTenantId = tenantId || (await resolveDefaultTenantId(null));
  if (!targetTenantId) {
    const err = new Error('No se encontró un tenant válido para registrar el pedido web.');
    err.statusCode = 400;
    throw err;
  }

  const baseOrigin = getWebIntegrationCandidateUrls(envOverride)[0] || 'https://decovintage.online';
  const rawOrder = payload?.order && typeof payload.order === 'object' ? payload.order : payload;
  const candidateSkus = (Array.isArray(rawOrder?.items) ? rawOrder.items : [])
    .map((it) => (it?.sku && String(it.sku).trim()) || (it?.posterId != null ? `WEB-${it.posterId}` : null))
    .filter(Boolean);

  let productMapBySku = new Map();
  if (candidateSkus.length > 0 && typeof prismaClient.product?.findMany === 'function') {
    try {
      const prods = await prismaClient.product.findMany({
        where: { tenantId: targetTenantId, sku: { in: candidateSkus } },
        select: { id: true, sku: true, name: true, imageUrl: true },
      });
      productMapBySku = new Map((prods || []).map((p) => [p.sku, p]));
    } catch { /* ignore product lookup failure */ }
  }

  const normalized = normalizeWebOrderPayload(payload, { baseOrigin, productMapBySku });
  const existing = await findExistingInboxOrder(prismaClient, targetTenantId, normalized.orderNumber);

  if (existing && (existing.status === 'IMPORTADO' || existing.status === 'DESCARTADO')) {
    return { record: existing, action: 'SKIPPED_TERMINAL', created: false, updated: false };
  }

  if (existing) {
    const updated = await prismaClient.webOrderInbox.update({
      where: { id: existing.id },
      data: {
        externalOrderId: normalized.externalOrderId || existing.externalOrderId,
        orderSource: normalized.orderSource,
        customerName: normalized.customerName,
        customerPhone: normalized.customerPhone,
        customerAddress: normalized.customerAddress,
        customerDepartment: normalized.customerDepartment,
        customerNotes: normalized.customerNotes,
        totalUnits: normalized.totalUnits,
        quotedTotal: normalized.quotedTotal,
        items: normalized.items,
        rawPayload: normalized.rawPayload,
        webCreatedAt: normalized.webCreatedAt || existing.webCreatedAt,
      },
    });
    return { record: updated, action: 'UPDATED', created: false, updated: true };
  }

  const incomingStatus = String(rawOrder?.status || 'PENDIENTE').trim().toUpperCase();
  const initialStatus = incomingStatus === 'IMPORTADO'
    ? 'IMPORTADO'
    : (incomingStatus === 'CANCELADO' || incomingStatus === 'DESCARTADO') ? 'DESCARTADO' : 'PENDIENTE';

  const created = await prismaClient.webOrderInbox.create({
    data: {
      tenantId: targetTenantId,
      status: initialStatus,
      ...normalized,
    },
  });
  return { record: created, action: 'CREATED', created: true, updated: false };
}

export const ingestWebOrderWebhook = upsertWebOrderInboxRecord;

export async function listWebOrders({ tenantId, status = 'PENDIENTE', source = null, search = null, page = 1, limit = 50, prismaClient = prisma } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const take = Math.min(200, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * take;
  const where = { tenantId };

  const normStatus = String(status || 'PENDIENTE').toUpperCase();
  if (['PENDIENTE', 'IMPORTADO', 'DESCARTADO'].includes(normStatus)) where.status = normStatus;

  const normSource = source ? String(source).toUpperCase() : '';
  if (['WEB_CART', 'WEB_CUSTOM', 'WEB_QUICK_POSTER'].includes(normSource)) where.orderSource = normSource;

  if (search && String(search).trim()) {
    const q = String(search).trim().replace(/^#+/, '');
    where.OR = [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
      { customerPhone: { contains: q } },
    ];
  }

  const [orders, total, pending, imported, discarded] = await Promise.all([
    prismaClient.webOrderInbox.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prismaClient.webOrderInbox.count({ where }),
    prismaClient.webOrderInbox.count({ where: { tenantId, status: 'PENDIENTE' } }),
    prismaClient.webOrderInbox.count({ where: { tenantId, status: 'IMPORTADO' } }),
    prismaClient.webOrderInbox.count({ where: { tenantId, status: 'DESCARTADO' } }),
  ]);

  return {
    orders,
    total,
    page: pageNum,
    limit: take,
    totalPages: Math.max(1, Math.ceil(total / take)),
    counts: { pending, imported, discarded },
  };
}

export async function notifyWebOrderStatus({ orderNumber, status, externalSaleNumber = null, fetchImpl = fetch, envOverride = null } = {}) {
  const cleanOrderNumber = normalizeWebOrderNumber(orderNumber);
  const secret = resolveExpectedWebOrdersSecret(envOverride);
  if (!cleanOrderNumber || !secret || typeof fetchImpl !== 'function') {
    return { notified: false, reason: !secret ? 'NO_SECRET' : 'SKIPPED' };
  }

  for (const baseUrl of getWebIntegrationCandidateUrls(envOverride)) {
    const url = `${baseUrl}/api/custom-orders/integration/${encodeURIComponent(cleanOrderNumber)}/status`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetchImpl(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-webhook-secret': secret,
        },
        body: JSON.stringify({
          status,
          ...(externalSaleNumber ? { externalSaleNumber } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) return { notified: true, status: res.status, url };
    } catch (err) {
      console.warn(`[notifyWebOrderStatus] Advertencia notificando ${cleanOrderNumber} a ${url}:`, err?.message || err);
    }
  }
  return { notified: false, reason: 'REMOTE_UNREACHABLE' };
}

export async function syncWebOrdersFromWeb({ tenantId, status = 'PENDIENTE', limit = 100, fetchImpl = fetch, prismaClient = prisma, envOverride = null } = {}) {
  const secret = resolveExpectedWebOrdersSecret(envOverride);
  if (!secret) {
    return { success: false, synced: false, totalFetched: 0, createdCount: 0, updatedCount: 0, skippedCount: 0, warning: 'Secreto S2S (WEB_ORDERS_WEBHOOK_SECRET / CATALOG_WEBHOOK_SECRET) no configurado.' };
  }

  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  const queryStatus = ['PENDIENTE', 'IMPORTADO'].includes(String(status || '').toUpperCase()) ? String(status).toUpperCase() : 'PENDIENTE';
  let remoteOrders = null;
  let sourceUrl = null;
  let lastWarning = null;

  for (const baseUrl of getWebIntegrationCandidateUrls(envOverride)) {
    const url = `${baseUrl}/api/custom-orders/integration/inbox?status=${encodeURIComponent(queryStatus)}&limit=${safeLimit}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'x-webhook-secret': secret },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json?.data) ? json.data : (Array.isArray(json?.orders) ? json.orders : []);
        remoteOrders = items;
        sourceUrl = url;
        break;
      }
      lastWarning = `Respuesta remota HTTP ${res.status} desde ${baseUrl}`;
    } catch (err) {
      lastWarning = err?.message || 'Error de red consultando bandeja web';
    }
  }

  if (!Array.isArray(remoteOrders)) {
    return {
      success: false,
      synced: false,
      totalFetched: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      warning: lastWarning || 'Bandeja remota de Web Deco Vintage no disponible temporalmente.',
    };
  }

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  for (const rawOrder of remoteOrders) {
    if (!rawOrder?.orderNumber) continue;
    const res = await upsertWebOrderInboxRecord({ tenantId, payload: rawOrder, prismaClient, envOverride });
    if (res.created) createdCount++;
    else if (res.updated) updatedCount++;
    else skippedCount++;
  }

  return {
    success: true,
    synced: true,
    totalFetched: remoteOrders.length,
    createdCount,
    updatedCount,
    skippedCount,
    sourceUrl,
  };
}

export async function discardWebOrder({ tenantId, id, userId = null, reason = null, fetchImpl = fetch, prismaClient = prisma, envOverride = null } = {}) {
  const existing = await prismaClient.webOrderInbox.findFirst({ where: { id, tenantId } });
  if (!existing) {
    const err = new Error('Pedido web no encontrado.');
    err.statusCode = 404;
    throw err;
  }
  if (existing.status === 'IMPORTADO') {
    const err = new Error(`El pedido web #${existing.orderNumber} ya fue importado como venta (${existing.importedSaleNumber || 'registrada'}) y no puede descartarse.`);
    err.statusCode = 409;
    throw err;
  }

  const updated = await prismaClient.webOrderInbox.update({
    where: { id: existing.id },
    data: {
      status: 'DESCARTADO',
      discardedById: userId || null,
      discardedAt: new Date(),
      discardReason: reason ? String(reason).trim() : null,
    },
  });

  if (typeof prismaClient.auditLog?.create === 'function') {
    await prismaClient.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        action: 'PEDIDO_WEB_DESCARTADO',
        entity: 'web_order_inbox',
        entityId: existing.id,
        details: { orderNumber: existing.orderNumber, reason: updated.discardReason },
      },
    });
  }

  await notifyWebOrderStatus({ orderNumber: existing.orderNumber, status: 'CANCELADO', fetchImpl, envOverride });
  return updated;
}

export async function restoreWebOrder({ tenantId, id, userId = null, fetchImpl = fetch, prismaClient = prisma, envOverride = null } = {}) {
  const existing = await prismaClient.webOrderInbox.findFirst({ where: { id, tenantId } });
  if (!existing) {
    const err = new Error('Pedido web no encontrado.');
    err.statusCode = 404;
    throw err;
  }
  if (existing.status === 'IMPORTADO') {
    const err = new Error(`El pedido web #${existing.orderNumber} ya tiene una venta registrada y no puede restaurarse a pendiente.`);
    err.statusCode = 409;
    throw err;
  }

  const updated = await prismaClient.webOrderInbox.update({
    where: { id: existing.id },
    data: {
      status: 'PENDIENTE',
      discardedById: null,
      discardedAt: null,
      discardReason: null,
    },
  });

  if (typeof prismaClient.auditLog?.create === 'function') {
    await prismaClient.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        action: 'PEDIDO_WEB_RESTAURADO',
        entity: 'web_order_inbox',
        entityId: existing.id,
        details: { orderNumber: existing.orderNumber },
      },
    });
  }

  await notifyWebOrderStatus({ orderNumber: existing.orderNumber, status: 'PENDIENTE', fetchImpl, envOverride });
  return updated;
}
