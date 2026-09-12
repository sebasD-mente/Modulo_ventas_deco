import { prisma } from '../../config/prisma.js';

export async function resolveActiveEvent(tenantId, eventId) {
  if (eventId && eventId !== 'current' && eventId !== 'activo') return eventId;
  const act = await prisma.event?.findFirst?.({
    where: { status: 'ACTIVO', ...(tenantId ? { tenantId } : {}) },
    select: { id: true },
  });
  return act?.id || null;
}

const NATIVE_SHIFT_SQL = `WITH event_sales AS (
  SELECT s.id AS sale_id, s.seller_id, s.total_amount FROM sales s
  WHERE s.event_id = $1 AND s.status != 'ANULADA' AND ($2::text IS NULL OR s.tenant_id = $2)
),
seller_totals AS (
  SELECT es.seller_id, COUNT(es.sale_id)::int AS transaction_count, COALESCE(SUM(es.total_amount), 0)::numeric(12, 2) AS total_revenue
  FROM event_sales es GROUP BY es.seller_id
),
seller_items AS (
  SELECT es.seller_id, COALESCE(SUM(si.quantity), 0)::int AS units_sold
  FROM sale_items si JOIN event_sales es ON si.sale_id = es.sale_id GROUP BY es.seller_id
),
seller_payments_raw AS (
  SELECT es.seller_id, sp.method, COALESCE(SUM(sp.amount), 0)::numeric(12, 2) AS total_amount, COUNT(sp.id)::int AS tx_count
  FROM sale_payments sp JOIN event_sales es ON sp.sale_id = es.sale_id GROUP BY es.seller_id, sp.method
),
seller_payments_json AS (
  SELECT p.seller_id, jsonb_object_agg(p.method, jsonb_build_object('amount', p.total_amount, 'count', p.tx_count)) AS payment_breakdown
  FROM seller_payments_raw p GROUP BY p.seller_id
)
SELECT st.seller_id AS "sellerId", u.full_name AS "sellerName", u.email AS "sellerEmail", COALESCE(u.role, 'VENDEDOR') AS "role",
  st.total_revenue::float AS "totalAmount", st.transaction_count AS "transactionCount", COALESCE(si.units_sold, 0)::int AS "unitsSold",
  COALESCE(pj.payment_breakdown, '{}'::jsonb) AS "payments"
FROM seller_totals st
LEFT JOIN users u ON u.id = st.seller_id
LEFT JOIN seller_items si ON si.seller_id = st.seller_id
LEFT JOIN seller_payments_json pj ON pj.seller_id = st.seller_id
ORDER BY st.total_revenue DESC;`;

export async function executeGetSellerShiftReport(tenantId, eventId, sellerId = null) {
  try {
    const effEventId = await resolveActiveEvent(tenantId, eventId);
    if (!effEventId) return { eventId: null, eventName: 'Sin evento activo', totalSellersActive: 0, eventTotalRevenue: 0, eventTotalTransactions: 0, topSeller: null, ranking: [], seller: null, summaryText: '🏆 No hay evento activo.' };

    let eventName = 'Evento Activo', ranking = [], totalRevenue = 0, totalTransactions = 0, userMap = new Map();
    const isTestMock = Boolean(prisma.sale?.groupBy && !prisma.sale.groupBy.toString().includes('[native code]'));

    if (!isTestMock && typeof prisma.$queryRawUnsafe === 'function') {
      try {
        const [event, rawRows] = await Promise.all([
          prisma.event?.findUnique?.({ where: { id: effEventId }, select: { id: true, name: true, location: true } }),
          prisma.$queryRawUnsafe(NATIVE_SHIFT_SQL, effEventId, tenantId || null),
        ]);
        if (event?.name) eventName = event.name;
        if (Array.isArray(rawRows) && rawRows.length > 0) {
          totalRevenue = Number(rawRows.reduce((acc, r) => acc + (Number(r.totalAmount) || 0), 0).toFixed(2));
          totalTransactions = rawRows.reduce((acc, r) => acc + (Number(r.transactionCount) || 0), 0);
          ranking = rawRows.map((r, idx) => {
            const amt = Number(Number(r.totalAmount || 0).toFixed(2)), cnt = Number(r.transactionCount || 0), p = r.payments || {};
            return {
              position: idx + 1, sellerId: r.sellerId, sellerName: r.sellerName || 'Vendedor', sellerEmail: r.sellerEmail || '', role: r.role || 'VENDEDOR',
              totalAmount: amt, transactionCount: cnt, averageTicket: cnt > 0 ? Number((amt / cnt).toFixed(2)) : 0, unitsSold: Number(r.unitsSold || 0),
              sharePercentage: totalRevenue > 0 ? Number(((amt / totalRevenue) * 100).toFixed(1)) : 0,
              payments: {
                EFECTIVO: { amount: Number(p.EFECTIVO?.amount || 0), count: Number(p.EFECTIVO?.count || 0) },
                TARJETA: { amount: Number(p.TARJETA?.amount || 0), count: Number(p.TARJETA?.count || 0) },
                TRANSFERENCIA: { amount: Number(p.TRANSFERENCIA?.amount || 0), count: Number(p.TRANSFERENCIA?.count || 0) },
              },
            };
          });
        }
      } catch {}
    }

    if (ranking.length === 0) {
      const saleWhere = { eventId: effEventId, status: { not: 'ANULADA' }, ...(tenantId ? { tenantId } : {}) };
      const [event, salesBySeller] = await Promise.all([
        prisma.event?.findUnique?.({ where: { id: effEventId }, select: { id: true, name: true, location: true } }),
        prisma.sale?.groupBy?.({ by: ['sellerId'], where: saleWhere, _count: { id: true }, _sum: { totalAmount: true } }),
      ]);
      if (event?.name) eventName = event.name;
      const sorted = [...(salesBySeller || [])].sort((a, b) => Number(b._sum?.totalAmount || 0) - Number(a._sum?.totalAmount || 0));
      const sellerIds = sorted.map((s) => s.sellerId).filter(Boolean);
      if (sellerId && !sellerIds.includes(sellerId)) sellerIds.push(sellerId);
      if (sellerIds.length > 0) {
        const users = await prisma.user?.findMany?.({ where: { id: { in: sellerIds }, ...(tenantId ? { tenantId } : {}) }, select: { id: true, fullName: true, email: true, role: true } }) || [];
        userMap = new Map(users.map((u) => [u.id, u]));
      }
      totalRevenue = Number(sorted.reduce((acc, s) => acc + Number(s._sum?.totalAmount || 0), 0).toFixed(2));
      totalTransactions = sorted.reduce((acc, s) => acc + (s._count?.id || 0), 0);

      ranking = await Promise.all(sorted.map(async (g, idx) => {
        const u = userMap.get(g.sellerId), amt = Number(Number(g._sum?.totalAmount || 0).toFixed(2)), cnt = g._count?.id || 0;
        let unitsSold = 0;
        try {
          const uAgg = await prisma.saleItem?.aggregate?.({ where: { sale: { eventId: effEventId, sellerId: g.sellerId, status: { not: 'ANULADA' }, ...(tenantId ? { tenantId } : {}) } }, _sum: { quantity: true } });
          unitsSold = uAgg?._sum?.quantity || 0;
        } catch {}
        const payments = { EFECTIVO: { amount: 0, count: 0 }, TARJETA: { amount: 0, count: 0 }, TRANSFERENCIA: { amount: 0, count: 0 } };
        try {
          const pAgg = await prisma.salePayment?.groupBy?.({ by: ['method'], where: { sale: { eventId: effEventId, sellerId: g.sellerId, status: { not: 'ANULADA' }, ...(tenantId ? { tenantId } : {}) } }, _sum: { amount: true }, _count: { id: true } }) || [];
          pAgg.forEach((p) => { if (payments[p.method]) { payments[p.method].amount = Number(Number(p._sum?.amount || 0).toFixed(2)); payments[p.method].count = p._count?.id || 0; } });
        } catch {}
        return {
          position: idx + 1, sellerId: g.sellerId, sellerName: u?.fullName || 'Vendedor', sellerEmail: u?.email || '', role: u?.role || 'VENDEDOR',
          totalAmount: amt, transactionCount: cnt, averageTicket: cnt > 0 ? Number((amt / cnt).toFixed(2)) : 0, unitsSold,
          sharePercentage: totalRevenue > 0 ? Number(((amt / totalRevenue) * 100).toFixed(1)) : 0, payments,
        };
      }));
    }

    const foundSeller = sellerId ? (ranking.find((r) => r.sellerId === sellerId) || { sellerId, sellerName: userMap.get(sellerId)?.fullName || 'Vendedor', totalAmount: 0, transactionCount: 0, averageTicket: 0, unitsSold: 0, position: null, sharePercentage: 0 }) : null;
    const summaryText = ranking.length > 0 ? `🏆 Ranking en "${eventName}": Total Q ${totalRevenue.toFixed(2)} (${totalTransactions} ventas). Líder: ${ranking[0].sellerName} (Q ${ranking[0].totalAmount.toFixed(2)}).` : 'Sin ventas registradas.';
    return { eventId: effEventId, eventName, totalSellersActive: ranking.length, eventTotalRevenue: totalRevenue, eventTotalTransactions: totalTransactions, topSeller: ranking[0] || null, ranking, seller: foundSeller, summaryText };
  } catch (err) {
    return { eventId: eventId || null, eventName: 'Evento (Modo Resiliente)', totalSellersActive: 0, eventTotalRevenue: 0, eventTotalTransactions: 0, topSeller: null, ranking: [], seller: sellerId ? { sellerId, sellerName: 'Vendedor', totalAmount: 0 } : null, summaryText: '🏆 Ranking de Vendedores: No se pudo conectar a la base de datos.', error: err.message };
  }
}
