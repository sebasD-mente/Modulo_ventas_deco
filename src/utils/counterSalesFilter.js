/**
 * Utilidades puras de segregación y presentación de ventas en mostrador (POS Ferial)
 * frente a pedidos remotos con saldo pendiente de cobro/entrega.
 */

export function isPhysicalStandEvent(eventId) {
  const normalized = typeof eventId === 'string' ? eventId.trim() : '';
  return Boolean(normalized && normalized !== 'evt-ventas-redes-online');
}

export function extractStandBalancePayments(sale) {
  if (Array.isArray(sale?.standCollectedPayments) && sale.standCollectedPayments.length > 0) {
    return sale.standCollectedPayments;
  }
  return (sale?.payments || []).filter((p) => String(p?.reference || '').includes('[SALDO]'));
}

export function didSellerCollectStandBalance(sale, user) {
  if (!user?.id) return true;
  if (sale?.balanceCollectedById) {
    return sale.balanceCollectedById === user.id;
  }
  const rawNotes = String(sale?.notes || '');
  const stampMatch = rawNotes.match(/\[(?:Saldo|Anticipo)\s+Q[\d.]+\s+(?:cobrado|registrado)\s+por:\s*([^(\]]+)/i);
  if (stampMatch && user?.fullName) {
    return stampMatch[1].trim().toLowerCase() === String(user.fullName).trim().toLowerCase();
  }
  return true;
}

/**
 * Separa estrictamente las ventas de un punto de venta en:
 * - defaultSales: ventas cobradas en mostrador (propias del vendedor + saldos remotos liquidados por ese vendedor).
 *   En stands físicos JAMÁS incluye ventas con balanceDue > 0.
 * - pendingSales: órdenes con saldo pendiente (balanceDue > 0) asignadas para entrega en ese punto de venta.
 */
export function partitionEventSalesForPos({
  sales = [],
  eventId = null,
  user = null,
  isVendedor = false,
  isSuperAdmin = false,
} = {}) {
  const list = Array.isArray(sales) ? sales.filter((s) => s && s.status !== 'ANULADA') : [];
  const isStandPos = isPhysicalStandEvent(eventId);
  const isCounterSellerOnly = Boolean(isStandPos && isVendedor && !isSuperAdmin);

  const pendingSales = list.filter((s) => {
    if (Number(s.balanceDue || 0) <= 0) return false;
    if (!isStandPos) return true;
    return s.pickupEventId === eventId || s.eventId === eventId;
  });

  if (!isStandPos) {
    return {
      isStandPos: false,
      defaultSales: list,
      pendingSales,
    };
  }

  const defaultSales = list.filter((s) => {
    if (Number(s.balanceDue || 0) > 0) return false;

    const isRemoteOrder = s.orderType === 'REDES_PERSONALIZADO' || (s.eventId && s.eventId !== eventId);

    if (!isRemoteOrder) {
      if (s.eventId && s.eventId !== eventId) return false;
      if (isCounterSellerOnly && user?.id && s.sellerId) {
        return s.sellerId === user.id;
      }
      return true;
    }

    if (s.pickupEventId && s.pickupEventId !== eventId) return false;
    const standPayments = extractStandBalancePayments(s);
    const collectedInStand = Number(s.standCollectedAmount || 0) > 0 || standPayments.length > 0;
    if (!collectedInStand) return false;

    if (isCounterSellerOnly) {
      return didSellerCollectStandBalance(s, user);
    }
    return true;
  });

  return {
    isStandPos: true,
    defaultSales,
    pendingSales,
  };
}

/**
 * Resuelve los montos, pagos y marca temporal que debe mostrar una fila en mostrador.
 * Si es un pedido remoto cuyo saldo restante ya fue cobrado en el stand, expone
 * exclusivamente el monto cobrado en mostrador y los métodos de pago de dicho saldo.
 */
export function resolveStandSaleDisplay(sale, standEventId = null) {
  const hasBalance = Number(sale?.balanceDue || 0) > 0;
  const isStandPos = isPhysicalStandEvent(standEventId);
  const isRemoteSettledForStand = Boolean(
    isStandPos &&
    !hasBalance &&
    (sale?.orderType === 'REDES_PERSONALIZADO' || (sale?.eventId && sale.eventId !== standEventId))
  );

  const standBalancePayments = isRemoteSettledForStand ? extractStandBalancePayments(sale) : [];
  const rawStandCollected = sale?.standCollectedAmount !== undefined && sale?.standCollectedAmount !== null
    ? Number(sale.standCollectedAmount)
    : standBalancePayments.reduce((acc, p) => acc + Number(p?.amount || 0), 0);

  const isStandBalanceCollection = Boolean(
    isRemoteSettledForStand && (standBalancePayments.length > 0 || rawStandCollected > 0)
  );

  const totalAmount = Number(Number(sale?.totalAmount || 0).toFixed(2));
  const displayedAmount = isStandBalanceCollection
    ? Number(rawStandCollected.toFixed(2))
    : totalAmount;
  const previousDepositAmount = isStandBalanceCollection
    ? Number(Math.max(0, totalAmount - displayedAmount).toFixed(2))
    : 0;
  const displayedPayments = isStandBalanceCollection && standBalancePayments.length > 0
    ? standBalancePayments
    : (sale?.payments || []);
  const displayedTimestamp = isStandBalanceCollection
    ? (sale?.standCollectedAt || standBalancePayments[standBalancePayments.length - 1]?.createdAt || sale?.updatedAt || sale?.createdAt)
    : sale?.createdAt;

  return {
    hasBalance,
    isStandBalanceCollection,
    displayedAmount,
    previousDepositAmount,
    displayedPayments,
    displayedTimestamp,
  };
}
