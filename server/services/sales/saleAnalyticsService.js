import { prisma } from '../../config/prisma.js';
import { getGuatemalaDayRange } from './saleKpiService.js';

const formatHour12 = (h) => (h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`);

async function resolveActiveEvent(tenantId, eventId) {
  if (eventId && eventId !== 'current' && eventId !== 'activo') return eventId;
  const ev = await prisma.event?.findFirst?.({
    where: { status: 'ACTIVO', ...(tenantId ? { tenantId } : {}) },
    select: { id: true, name: true }
  });
  return ev?.id || null;
}

/**
 * Analítica y distribución de ventas por hora civil de Guatemala (UTC-6)
 */
export async function getHourlySalesAnalytics({ tenantId, eventId, date = null }) {
  try {
    const effEventId = await resolveActiveEvent(tenantId, eventId);
    const eventRecord = effEventId ? await prisma.event.findUnique({ where: { id: effEventId }, select: { id: true, name: true, location: true } }) : null;

    const baseWhere = { status: { not: 'ANULADA' }, ...(effEventId ? { eventId: effEventId } : {}), ...(tenantId ? { tenantId } : {}) };
    let { targetDate, startOfDay, endOfDay } = getGuatemalaDayRange(date);
    let sales = await prisma.sale.findMany({
      where: { ...baseWhere, createdAt: { gte: startOfDay, lte: endOfDay } },
      select: { id: true, totalAmount: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });

    if (sales.length === 0 && !date && effEventId) {
      sales = await prisma.sale.findMany({ where: baseWhere, select: { id: true, totalAmount: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 300 });
    }

    if (sales.length === 0) {
      return { eventId: effEventId, eventName: eventRecord?.name || 'Evento Activo', date: targetDate, totalAmount: 0, totalTransactions: 0, peakWindow: 'Sin registros aún', peakAmount: 0, peakPercentage: 0, hourlyBreakdown: [] };
    }

    const hourMap = new Map();
    let grandTotal = 0;
    for (const s of sales) {
      const d = new Date(s.createdAt);
      const hour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guatemala', hour: 'numeric', hour12: false }).format(d), 10);
      const amt = Number(s.totalAmount) || 0;
      grandTotal += amt;
      const cur = hourMap.get(hour) || { hour, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += amt;
      hourMap.set(hour, cur);
    }

    grandTotal = Number(grandTotal.toFixed(2));
    const hours = Array.from(hourMap.keys()).sort((a, b) => a - b);
    const minHour = Math.min(...hours), maxHour = Math.max(...hours);
    const hourlyBreakdown = [];
    let maxHourAmount = 0, peakHour = minHour;

    for (let h = minHour; h <= maxHour; h++) {
      const data = hourMap.get(h) || { hour: h, count: 0, amount: 0 };
      const percentage = grandTotal > 0 ? Number(((data.amount / grandTotal) * 100).toFixed(1)) : 0;
      if (data.amount > maxHourAmount) { maxHourAmount = data.amount; peakHour = h; }
      hourlyBreakdown.push({ hour: h, label: formatHour12(h), amount: Number(data.amount.toFixed(2)), count: data.count, percentage });
    }

    const peakNext = peakHour + 1 <= maxHour ? peakHour + 1 : peakHour;
    const peakBlockAmount = (hourMap.get(peakHour)?.amount || 0) + (peakNext !== peakHour ? (hourMap.get(peakNext)?.amount || 0) : 0);
    const peakPercentage = grandTotal > 0 ? Number(((peakBlockAmount / grandTotal) * 100).toFixed(1)) : 0;
    const peakWindow = peakNext !== peakHour ? `${formatHour12(peakHour)} - ${formatHour12(peakNext + 1)}` : `${formatHour12(peakHour)} - ${formatHour12(peakHour + 1)}`;
    hourlyBreakdown.forEach((it) => { it.isPeak = it.hour === peakHour || (peakNext !== peakHour && it.hour === peakNext); });

    return { eventId: effEventId, eventName: eventRecord?.name || 'Evento Activo', date: targetDate, totalAmount: grandTotal, totalTransactions: sales.length, peakWindow, peakAmount: Number(peakBlockAmount.toFixed(2)), peakPercentage, hourlyBreakdown };
  } catch (err) {
    return { eventId: eventId || null, eventName: 'Evento (Modo Resiliente)', date: date || 'Hoy', totalAmount: 0, totalTransactions: 0, peakWindow: 'Tarde-Noche (Estimado)', peakAmount: 0, peakPercentage: 0, hourlyBreakdown: [] };
  }
}

const cleanPosterTitle = (desc) => (desc || 'Obra Sin Título')
  .replace(/\s*\((?:Mini|Pequeño|Pequeno|Mediano|Grande|Gigante|Portada(?:\s+de)?\s+Álbum|Portada(?:\s+de)?\s+Album|\d+\s*x\s*\d+\s*cm)\)\s*$/i, '')
  .replace(/\s*-\s*(?:Mini|Pequeño|Pequeno|Mediano|Grande|Gigante|Portada(?:\s+de)?\s+Álbum|Portada(?:\s+de)?\s+Album|\d+\s*x\s*\d+\s*cm)\s*$/i, '')
  .replace(/^Póster\s+(?:Mini|Pequeño|Pequeno|Mediano|Grande|Gigante)\s+/i, 'Póster ')
  .trim();

/**
 * Podio oficial con los 3 pósters más vendidos con métricas y recaudación contable exacta
 */
export async function getTopSellingPosters({ tenantId, eventId, date = null, limit = 3 } = {}) {
  try {
    const effEventId = await resolveActiveEvent(tenantId, eventId);
    const eventRecord = effEventId ? await prisma.event.findUnique({ where: { id: effEventId }, select: { id: true, name: true } }) : null;
    const saleWhere = { status: { not: 'ANULADA' }, ...(effEventId ? { eventId: effEventId } : {}), ...(tenantId ? { tenantId } : {}) };
    if (date) {
      const { startOfDay, endOfDay } = getGuatemalaDayRange(date);
      saleWhere.createdAt = { gte: startOfDay, lte: endOfDay };
    }

    const grouped = await prisma.saleItem.groupBy({
      by: ['description', 'productId'],
      where: { sale: saleWhere },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } }
    });

    const productIds = Array.from(new Set(grouped.map((g) => g.productId).filter(Boolean)));
    const products = productIds.length > 0 ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, imageUrl: true, category: true, basePrice: true } }) : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const consolidatedMap = new Map();
    for (const g of grouped) {
      const prod = g.productId ? productMap.get(g.productId) : null;
      const cleanTitle = prod?.name || cleanPosterTitle(g.description);
      const key = g.productId ? `p:${g.productId}` : `t:${cleanTitle.toLowerCase()}`;
      const units = Number(g._sum?.quantity) || 0;
      const subtotalVal = g._sum?.subtotal != null
        ? Number(g._sum.subtotal)
        : units * (prod?.basePrice ? Number(prod.basePrice) : 65.0);

      if (!consolidatedMap.has(key)) {
        consolidatedMap.set(key, {
          id: g.productId || `top-poster-${consolidatedMap.size}`,
          title: cleanTitle,
          category: prod?.category || 'ARTE',
          unitsSold: units,
          totalRevenue: subtotalVal,
          imageUrl: prod?.imageUrl || null,
          thumbUrl: prod?.imageUrl || null,
          basePrice: prod?.basePrice ? Number(prod.basePrice) : null
        });
      } else {
        const item = consolidatedMap.get(key);
        item.unitsSold += units;
        item.totalRevenue += subtotalVal;
        if (!item.imageUrl && prod?.imageUrl) {
          item.imageUrl = prod.imageUrl;
          item.thumbUrl = prod.imageUrl;
        }
      }
    }

    const take = 3; // Tope estricto del podio Top 3
    const topPosters = Array.from(consolidatedMap.values())
      .sort((a, b) => b.unitsSold - a.unitsSold || b.totalRevenue - a.totalRevenue)
      .slice(0, take)
      .map((poster, idx) => {
        const totalRev = Number(poster.totalRevenue.toFixed(2));
        const unitPrice = poster.unitsSold > 0 ? Number((totalRev / poster.unitsSold).toFixed(2)) : (poster.basePrice || 65.0);
        return {
          rank: idx + 1,
          id: poster.id,
          title: poster.title,
          category: poster.category,
          unitsSold: poster.unitsSold,
          unitPrice,
          totalRevenue: totalRev,
          imageUrl: poster.imageUrl,
          thumbUrl: poster.thumbUrl
        };
      });

    return { eventId: effEventId, eventName: eventRecord?.name || 'Evento Activo', count: topPosters.length, topPosters };
  } catch (err) {
    return { eventId: eventId || null, eventName: 'Evento (Modo Resiliente)', count: 0, topPosters: [] };
  }
}
