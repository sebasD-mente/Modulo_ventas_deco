import { Type } from '@google/genai';
import { prisma } from '../../config/prisma.js';
import { searchWebPosters } from '../webCatalogService.js';
import { extractPaymentMethod, resolveEntityAlias, normalizeArtworkQuery } from '../semanticParserService.js';
import { normalizeCatalogSizeId, matchPosterEverywhere } from './aiMediaService.js';

export const prepareSaleDraftDeclaration = { name: 'prepareSaleDraft', description: 'Prepara o actualiza de inmediato el borrador de venta en el mostrador ante cualquier solicitud de compra, dictado, confirmación ("dame uno", "quiero uno", "apúntalo", "lo llevo", "1 mediano en efectivo", "cobrale un mediano") o modificación de la orden.', parameters: { type: Type.OBJECT, properties: { items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { productName: { type: Type.STRING }, quantity: { type: Type.INTEGER }, unitPrice: { type: Type.NUMBER }, size: { type: Type.STRING } }, required: ['productName', 'quantity'] } }, total: { type: Type.NUMBER }, discount: { type: Type.NUMBER }, paymentMethod: { type: Type.STRING, enum: ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'] }, notes: { type: Type.STRING }, customerName: { type: Type.STRING } }, required: ['items'] } };
export const searchCatalogDeclaration = { name: 'searchCatalog', description: 'Busca obras y pósters en el catálogo oficial de Deco Vintage por palabras clave, personaje, franquicia o artista. Acompaña siempre la búsqueda con recomendaciones proactivas.', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING }, category: { type: Type.STRING } }, required: ['query'] } };
export const getEventKPIsDeclaration = { name: 'getEventKPIs', description: 'Obtiene las métricas y KPIs en tiempo real del evento activo en PostgreSQL: total vendido, transacciones, etc.', parameters: { type: Type.OBJECT, properties: { eventId: { type: Type.STRING }, date: { type: Type.STRING } } } };
export const getCashDrawerStatusDeclaration = { name: 'getCashDrawerStatus', description: 'Consulta el estado del efectivo en gaveta del stand, total en tarjetas, transferencias y último arqueo de caja registrado.', parameters: { type: Type.OBJECT, properties: { eventId: { type: Type.STRING } } } };
export const getSellerShiftReportDeclaration = { name: 'getSellerShiftReport', description: 'Consulta el ranking y métricas de ventas por vendedor en el evento activo (ventas totales, monto total, ticket promedio).', parameters: { type: Type.OBJECT, properties: { eventId: { type: Type.STRING }, sellerId: { type: Type.STRING } } } };
export const getProductionQueueStatusDeclaration = { name: 'getProductionQueueStatus', description: 'Consulta el estado de la cola de impresión y producción de obras en taller (PENDIENTE, SEPARADO, A_PRODUCCION, IMPRESO) y demoras.', parameters: { type: Type.OBJECT, properties: { eventId: { type: Type.STRING } } } };
export const checkInventoryStockDeclaration = { name: 'checkInventoryStock', description: 'Verifica las existencias y disponibilidad física de una obra en el stand o catálogo.', parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING }, sizeId: { type: Type.STRING } }, required: ['query'] } };
export const salesAssistantTools = [{ functionDeclarations: [prepareSaleDraftDeclaration, searchCatalogDeclaration, getEventKPIsDeclaration, getCashDrawerStatusDeclaration, getSellerShiftReportDeclaration, getProductionQueueStatusDeclaration, checkInventoryStockDeclaration] }];

const DEFAULT_SIZES = [{ sizeId: 'MINI', nombre: 'Mini', precio: 25 }, { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 }, { sizeId: 'PORTADA_ALBUM', nombre: 'Portada Álbum', precio: 55, badge: '🎵 Vinilo / 30x30' }, { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65, badge: '⭐ Más vendido' }, { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 }, { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 180 }];
const sizePrice = (s) => s === 'PORTADA_ALBUM' ? 55.0 : s === 'MINI' ? 25.0 : s === 'PEQUENO' ? 35.0 : s === 'GRANDE' ? 125.0 : s === 'GIGANTE' ? 180.0 : 65.0;
const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
async function resolveActiveEvent(tenantId, eventId) {
  if (eventId && eventId !== 'current' && eventId !== 'activo') return eventId;
  const act = await prisma.event?.findFirst?.({ where: { status: 'ACTIVO', ...(tenantId ? { tenantId } : {}) }, select: { id: true } });
  return act?.id || null;
}

export async function constructDraftPayload(tenantId, args, userMessage = '') {
  const rawItems = Array.isArray(args?.items) ? args.items.filter((it) => it && typeof it === 'object') : [];
  const enrichedItems = [];
  let grandTotal = 0;
  const textToScan = [userMessage, args?.notes].filter(Boolean).join(' ');
  const finalPayment = extractPaymentMethod(textToScan) || args?.paymentMethod || 'EFECTIVO';
  for (const it of rawItems) {
    const rawName = it.productName || it.title || it.description || 'Póster';
    const aliasRes = resolveEntityAlias(rawName);
    const queryName = aliasRes.matched ? aliasRes.searchQuery : rawName;
    const requestedSize = it.size || (aliasRes.matched && aliasRes.defaultSizeId) || 'MEDIANO';
    const matched = await matchPosterEverywhere(tenantId, queryName, requestedSize);
    const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
    const normSize = normalizeCatalogSizeId(requestedSize);
    const isAlbum = (matched?.sizeId === 'PORTADA_ALBUM' || normSize === 'PORTADA_ALBUM');
    const unitPrice = matched ? (isAlbum ? 55.0 : (matched.unitPrice || Number(it.unitPrice) || 65.0)) : (isAlbum ? 55.0 : (Number(it.unitPrice) || sizePrice(normSize)));
    const subtotal = Number((qty * unitPrice).toFixed(2));
    grandTotal += subtotal;
    if (matched) {
      enrichedItems.push({ productId: isUuid(matched?.productId) ? matched.productId : null, webPosterId: matched.posterId || null, description: matched.description, baseTitle: matched.baseTitle || rawName, category: matched.category || (aliasRes.matched ? aliasRes.category : 'ARTE'), thumbUrl: matched.thumbUrl || null, imageUrl: matched.imageUrl || null, quantity: qty, unitPrice, subtotal, sizeId: matched.sizeId || normSize, availableSizes: matched.availableSizes || [] });
    } else {
      enrichedItems.push({ productId: null, description: `${aliasRes.matched ? aliasRes.canonicalTitle : rawName} (${normSize})`, baseTitle: aliasRes.matched ? aliasRes.canonicalTitle : rawName, quantity: qty, unitPrice, subtotal, sizeId: normSize });
    }
  }
  return { items: enrichedItems, total: Number(grandTotal.toFixed(2)), discount: Number(args?.discount || 0), paymentMethod: finalPayment, inputChannel: 'IA_CHAT_TEXTO', notes: args?.notes || 'Venta dictada por STAND IA Chat', customerName: args?.customerName || null, transcription: userMessage };
}

export async function executeGetCashDrawerStatus(tenantId, eventId) {
  try {
    const effEventId = await resolveActiveEvent(tenantId, eventId);
    if (!effEventId) return { eventId: null, eventName: 'Sin evento activo', location: 'Stand', currency: 'GTQ', currencySymbol: 'Q', currentCashInDrawer: 0, cashSinceLastClosing: 0, salesCountSinceLastClosing: 0, totalSalesInCash: 0, cashTransactionsCount: 0, totalCardInSales: 0, cardTransactionsCount: 0, totalTransferInSales: 0, transferTransactionsCount: 0, grossSalesTotal: 0, lastClosing: null, summaryText: '💵 No hay evento activo.' };
    const event = await prisma.event?.findUnique?.({ where: { id: effEventId }, select: { id: true, name: true, location: true } });
    const saleWhere = { eventId: effEventId, ...(tenantId ? { tenantId } : {}), status: { not: 'ANULADA' } };
    const [payments, lastClosing] = await Promise.all([prisma.salePayment?.groupBy?.({ by: ['method'], where: { sale: saleWhere }, _sum: { amount: true }, _count: { id: true } }) || [], prisma.cashClosing?.findFirst?.({ where: { eventId: effEventId, ...(tenantId ? { tenantId } : {}) }, orderBy: { closingDate: 'desc' }, include: { closedBy: { select: { id: true, fullName: true, email: true } } } })]);
    let cash = 0, cashCnt = 0, card = 0, cardCnt = 0, transfer = 0, transferCnt = 0, other = 0, otherCnt = 0;
    (payments || []).forEach((p) => { const amt = Number(Number(p._sum?.amount || 0).toFixed(2)), c = p._count?.id || 0; if (p.method === 'EFECTIVO') { cash = amt; cashCnt = c; } else if (p.method === 'TARJETA') { card = amt; cardCnt = c; } else if (p.method === 'TRANSFERENCIA') { transfer = amt; transferCnt = c; } else { other += amt; otherCnt += c; } });
    let postCash = cash, postCnt = cashCnt;
    if (lastClosing) { const postAgg = await prisma.salePayment?.aggregate?.({ where: { method: 'EFECTIVO', sale: { ...saleWhere, createdAt: { gt: lastClosing.createdAt } } }, _sum: { amount: true }, _count: { id: true } }); postCash = Number(Number(postAgg?._sum?.amount || 0).toFixed(2)); postCnt = postAgg?._count?.id || 0; }
    let lastClosingInfo = null;
    if (lastClosing) {
      const diff = Number(lastClosing.cashDifference || 0);
      lastClosingInfo = { id: lastClosing.id, closingDate: lastClosing.closingDate, closedBy: lastClosing.closedBy?.fullName || 'Vendedor', closingType: lastClosing.closingType, calculatedCash: Number(lastClosing.totalCashCalculated || 0), reportedCash: Number(lastClosing.totalCashReported || 0), difference: diff, discrepancyStatus: diff === 0 ? 'CUADRADO' : diff > 0 ? 'SOBRANTE' : 'FALTANTE', observations: lastClosing.observations || null };
    }
    const estimated = lastClosing ? Number((Number(lastClosing.totalCashReported || 0) + postCash).toFixed(2)) : cash;
    const summaryText = lastClosingInfo ? `💵 Estado de Gaveta — "${event?.name || 'Evento'}": Hay aprox. Q ${estimated.toFixed(2)} en efectivo. Último arqueo: ${lastClosingInfo.discrepancyStatus} (dif: Q ${lastClosingInfo.difference.toFixed(2)}). Tarjeta: Q ${card.toFixed(2)} | Transf: Q ${transfer.toFixed(2)}.` : `💵 Estado de Gaveta — "${event?.name || 'Evento'}": Hay Q ${estimated.toFixed(2)} en efectivo. Tarjeta: Q ${card.toFixed(2)} | Transf: Q ${transfer.toFixed(2)}.`;
    return { eventId: effEventId, eventName: event?.name || 'Evento Activo', location: event?.location || 'Stand', currency: 'GTQ', currencySymbol: 'Q', currentCashInDrawer: estimated, cashSinceLastClosing: postCash, salesCountSinceLastClosing: postCnt, totalSalesInCash: cash, cashTransactionsCount: cashCnt, totalCardInSales: card, cardTransactionsCount: cardCnt, totalTransferInSales: transfer, transferTransactionsCount: transferCnt, grossSalesTotal: Number((cash + card + transfer + other).toFixed(2)), lastClosing: lastClosingInfo, summaryText };
  } catch (err) {
    return { eventId: eventId || null, eventName: 'Stand (Modo Resiliente)', location: 'Stand', currency: 'GTQ', currencySymbol: 'Q', currentCashInDrawer: 0, cashSinceLastClosing: 0, salesCountSinceLastClosing: 0, totalSalesInCash: 0, cashTransactionsCount: 0, totalCardInSales: 0, cardTransactionsCount: 0, totalTransferInSales: 0, transferTransactionsCount: 0, grossSalesTotal: 0, lastClosing: null, summaryText: '💵 Estado de Gaveta: No se pudo consultar la base de datos.', error: err.message };
  }
}
export { executeGetSellerShiftReport } from './aiShiftReportService.js';
export async function executeGetProductionQueueStatus(tenantId, eventId) {
  try {
    const effEventId = await resolveActiveEvent(tenantId, eventId);
    if (!effEventId) return { eventId: null, eventName: 'Sin evento activo', health: 'OPTIMO', counts: { pending: 0, separated: 0, inProduction: 0, printed: 0, total: 0, activeQueueCount: 0 }, timing: { averageQueueWaitMinutes: 0, maxWaitMinutes: 0, averagePrintTurnaroundMinutes: null, stalledThresholdMinutes: 30 }, stalledJobs: [], stalledCount: 0, summary: 'Cola de taller: No hay evento activo.' };
    const whereBase = { sale: { eventId: effEventId, status: { not: 'ANULADA' }, ...(tenantId ? { tenantId } : {}) } };
    const [groups, activeItems, recentPrinted, eventInfo] = await Promise.all([prisma.saleItem?.groupBy?.({ by: ['productionStatus'], where: whereBase, _count: { id: true } }) || [], prisma.saleItem?.findMany?.({ where: { ...whereBase, productionStatus: { in: ['PENDIENTE', 'A_PRODUCCION'] } }, include: { sale: { select: { saleNumber: true, createdAt: true, seller: { select: { fullName: true } } } } }, orderBy: { createdAt: 'asc' } }) || [], prisma.saleItem?.findMany?.({ where: { ...whereBase, productionStatus: 'IMPRESO', impresoAt: { not: null } }, select: { createdAt: true, impresoAt: true }, take: 20, orderBy: { impresoAt: 'desc' } }) || [], prisma.event?.findUnique?.({ where: { id: effEventId }, select: { id: true, name: true, location: true } })]);
    const counts = { pending: 0, separated: 0, inProduction: 0, printed: 0, total: 0, activeQueueCount: 0 };
    (groups || []).forEach((g) => {
      const c = g._count?.id || 0;
      if (g.productionStatus === 'PENDIENTE') counts.pending = c; else if (g.productionStatus === 'SEPARADO') counts.separated = c; else if (g.productionStatus === 'A_PRODUCCION') counts.inProduction = c; else if (g.productionStatus === 'IMPRESO') counts.printed = c;
      counts.total += c;
    });
    counts.activeQueueCount = counts.pending + counts.inProduction;
    const now = Date.now();
    let totalWait = 0, maxWait = 0;
    const stalledJobs = [];
    (activeItems || []).forEach((item) => {
      const wait = Math.max(0, Math.round((now - new Date(item.createdAt).getTime()) / 60000));
      totalWait += wait; if (wait > maxWait) maxWait = wait;
      if (wait >= 30) stalledJobs.push({ saleItemId: item.id, saleNumber: item.sale?.saleNumber || 'S/N', description: item.description, quantity: item.quantity, status: item.productionStatus, minutesInQueue: wait, urgency: wait >= 45 ? 'CRITICA' : 'ALTA', sellerName: item.sale?.seller?.fullName || 'Vendedor', createdAt: item.createdAt });
    });
    const avgWait = counts.activeQueueCount > 0 ? Math.round(totalWait / counts.activeQueueCount) : 0;
    let avgTurnaround = null;
    if (recentPrinted && recentPrinted.length > 0) {
      const sum = recentPrinted.reduce((acc, it) => acc + Math.max(0, (new Date(it.impresoAt).getTime() - new Date(it.createdAt).getTime()) / 60000), 0);
      avgTurnaround = Math.round(sum / recentPrinted.length);
    }
    const health = stalledJobs.some((j) => j.urgency === 'CRITICA') || counts.activeQueueCount > 15 ? 'CRITICO' : stalledJobs.length > 0 || counts.activeQueueCount > 8 ? 'SATURADO' : counts.activeQueueCount > 3 ? 'MODERADO' : 'OPTIMO';
    return { eventId: effEventId, eventName: eventInfo?.name || 'Evento Activo', health, counts, timing: { averageQueueWaitMinutes: avgWait, maxWaitMinutes: maxWait, averagePrintTurnaroundMinutes: avgTurnaround, stalledThresholdMinutes: 30 }, stalledJobs, stalledCount: stalledJobs.length, summary: `🖨️ Taller — "${eventInfo?.name || 'Evento'}": Salud ${health}. Cola activa: ${counts.activeQueueCount} (A_PRODUCCION: ${counts.inProduction}, PENDIENTE: ${counts.pending}). Espera prom: ${avgWait} min.` };
  } catch (err) {
    return { eventId: eventId || null, eventName: 'Evento (Modo Resiliente)', health: 'OPTIMO', counts: { pending: 0, separated: 0, inProduction: 0, printed: 0, total: 0, activeQueueCount: 0 }, timing: { averageQueueWaitMinutes: 0, maxWaitMinutes: 0, averagePrintTurnaroundMinutes: null, stalledThresholdMinutes: 30 }, stalledJobs: [], stalledCount: 0, summary: '🖨️ Estado de Taller: No se pudo consultar la base de datos.', error: err.message };
  }
}

export async function executeCheckInventoryStock(tenantId, query, sizeId = null, eventId = null) {
  if (!query || typeof query !== 'string' || !query.trim()) return { found: false, message: 'Debe especificar el nombre o alias de la obra a consultar.', suggestedPosters: [] };
  try {
    const cleanQuery = query.trim(), aliasRes = resolveEntityAlias(cleanQuery);
    const resolvedQuery = aliasRes.matched ? aliasRes.searchQuery : normalizeArtworkQuery(cleanQuery);
    const requestedSizeNorm = sizeId ? normalizeCatalogSizeId(sizeId) : (aliasRes.matched && aliasRes.defaultSizeId ? aliasRes.defaultSizeId : null);
    const matches = await searchWebPosters({ tenantId, query: resolvedQuery, limit: 6 });
    const posterMatches = Array.isArray(matches) ? [...matches] : [];
    if (posterMatches.length === 0) {
      if (aliasRes.matched) {
        posterMatches.push({ id: `alias-${aliasRes.canonicalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, sku: `DV-${aliasRes.canonicalTitle.substring(0, 4).toUpperCase()}`, titulo: aliasRes.canonicalTitle, subtitulo: 'Catálogo Oficial Deco Vintage', categoria: aliasRes.category || 'ARTE', imageUrl: null, thumbUrl: null, precioMinimo: aliasRes.defaultSizeId === 'PORTADA_ALBUM' ? 55 : 65, sizes: [...DEFAULT_SIZES] });
      } else {
        return { found: false, query: cleanQuery, resolvedQuery, message: `No se encontró la obra "${query}" en catálogo.`, availableInCatalog: false, suggestedPosters: [] };
      }
    }
    const primaryMatch = posterMatches[0];
    const allSizes = Array.isArray(primaryMatch.sizes) && primaryMatch.sizes.length > 0 ? [...primaryMatch.sizes] : [...DEFAULT_SIZES];
    if ((primaryMatch.categoria || '').toUpperCase() === 'MUSICA' && !allSizes.some((s) => s.sizeId === 'PORTADA_ALBUM')) {
      allSizes.unshift({ sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', precio: 55, badge: 'Formato vinilo cuadrado para música' });
    }
    let matchedSizeInfo = requestedSizeNorm ? (allSizes.find((s) => s.sizeId === requestedSizeNorm) || { sizeId: requestedSizeNorm, nombre: requestedSizeNorm, precio: sizePrice(requestedSizeNorm), dimensiones: requestedSizeNorm === 'PORTADA_ALBUM' ? '30 x 30 cm' : 'Estándar' }) : null;
    const targetSizeId = matchedSizeInfo?.sizeId || 'MEDIANO';
    const isDirectStock = ['MEDIANO', 'PORTADA_ALBUM', 'PEQUENO', 'MINI'].includes(targetSizeId);
    const stockAvailability = { availableInCatalog: true, standPhysicalStock: isDirectStock ? 'DISPONIBLE_MOSTRADOR' : 'PRODUCCION_TALLER', estimatedWaitMinutes: isDirectStock ? 0 : 12, tallerCapability: 'Impresión al instante con tintas HP Látex (>10 años de durabilidad)', deliveryMode: isDirectStock ? 'Entrega inmediata en mostrador' : 'Producción personalizada en taller (~10-15 min)' };
    return { found: true, query: cleanQuery, artwork: { id: primaryMatch.id, sku: primaryMatch.sku, title: primaryMatch.titulo, subtitle: primaryMatch.subtitulo || '', category: primaryMatch.categoria, imageUrl: primaryMatch.imageUrl, thumbUrl: primaryMatch.thumbUrl, basePrice: primaryMatch.precioMinimo }, requestedSize: matchedSizeInfo, allAvailableSizes: allSizes, stockAvailability, eventStockHistory: null, suggestedPosters: matches, summary: `🎨 Disponibilidad — "${primaryMatch.titulo}": ${stockAvailability.deliveryMode}.` };
  } catch (err) {
    return { found: false, query: query.trim(), message: `Error consultando stock: ${err.message}`, availableInCatalog: false, suggestedPosters: [] };
  }
}
