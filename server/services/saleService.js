import { prisma } from '../config/prisma.js';

/**
 * Genera un número de venta secuencial legible y atómico por evento (ej: CC26-0001)
 */
export async function generateSaleNumber(eventId, tx = prisma) {
  const updatedEvent = await (tx || prisma).event.update({
    where: { id: eventId },
    data: { currentSaleSequence: { increment: 1 } },
    select: { name: true, currentSaleSequence: true },
  });
  const prefix = updatedEvent?.name
    ? updatedEvent.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()
    : 'VENTA';
  const sequential = String(updatedEvent.currentSaleSequence).padStart(4, '0');
  return `${prefix}-${sequential}`;
}

/**
 * Registra una venta completa con integridad transaccional ACID
 */
export async function createSaleTransaction({
  tenantId,
  sellerId,
  eventId,
  items,
  payments,
  discount = 0,
  notes = null,
  inputChannel = 'MANUAL_POS',
  attachments = [],
}) {
  return await prisma.$transaction(async (tx) => {
    // 1. Calcular totales
    let itemsTotal = 0;
    const itemsData = items.map((item) => {
      const subtotal = Number((item.quantity * item.unitPrice).toFixed(2));
      itemsTotal += subtotal;
      return {
        productId: item.productId || null,
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal,
      };
    });

    const totalAmount = Number(Math.max(0, itemsTotal - discount).toFixed(2));

    // 2. Validar que los métodos de pago cubran el monto
    const paymentsTotal = payments.reduce((acc, p) => acc + Number(p.amount), 0);
    if (Math.abs(paymentsTotal - totalAmount) > 0.05) {
      throw new Error(`El monto pagado (Q ${paymentsTotal.toFixed(2)}) no coincide con el total de la venta (Q ${totalAmount.toFixed(2)})`);
    }

    // 3. Generar consecutivo atómico
    const updatedEvent = await tx.event.update({
      where: { id: eventId },
      data: { currentSaleSequence: { increment: 1 } },
      select: { name: true, currentSaleSequence: true },
    });
    const prefix = updatedEvent?.name
      ? updatedEvent.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()
      : 'VENTA';
    const sequential = String(updatedEvent.currentSaleSequence).padStart(4, '0');
    const saleNumber = `${prefix}-${sequential}`;

    // 4. Crear registro maestro de venta
    const sale = await tx.sale.create({
      data: {
        tenantId,
        eventId,
        sellerId,
        saleNumber,
        totalAmount,
        discount,
        notes,
        inputChannel,
        items: {
          create: itemsData,
        },
        payments: {
          create: payments.map((p) => ({
            method: p.method,
            amount: p.amount,
            reference: p.reference || null,
            receiptUrl: p.receiptUrl || null,
          })),
        },
        attachments: attachments.length > 0 ? {
          create: attachments.map((a) => ({
            fileUrl: a.fileUrl,
            fileType: a.fileType,
            transcription: a.transcription || null,
            aiMetadata: a.aiMetadata || null,
          })),
        } : undefined,
      },
      include: {
        items: true,
        payments: true,
        seller: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    // 5. Registrar log de auditoría
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: sellerId,
        action: 'VENTA_REGISTRADA',
        entity: 'sale',
        entityId: sale.id,
        details: {
          saleNumber,
          totalAmount,
          itemCount: items.length,
          inputChannel,
        },
      },
    });

    return sale;
  }, {
    maxWait: 15000,
    timeout: 30000,
  });
}

/**
 * Obtiene métricas y KPIs en tiempo real de un evento
 */
export async function getEventKPIs({ tenantId, eventId, date = null }) {
  const where = {
    tenantId,
    eventId,
    status: 'COMPLETADA',
  };

  if (date) {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    where.createdAt = {
      gte: startOfDay,
      lte: endOfDay,
    };
  }

  const sales = await prisma.sale.findMany({
    where,
    include: {
      items: true,
      payments: true,
      seller: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  let totalAmount = 0;
  let totalUnits = 0;
  const paymentBreakdown = {
    EFECTIVO: { count: 0, amount: 0 },
    TARJETA: { count: 0, amount: 0 },
    TRANSFERENCIA: { count: 0, amount: 0 },
    OTRO: { count: 0, amount: 0 },
  };

  const productCounts = {};

  sales.forEach((sale) => {
    totalAmount += Number(sale.totalAmount);

    sale.items.forEach((item) => {
      totalUnits += item.quantity;
      const desc = item.description;
      productCounts[desc] = (productCounts[desc] || 0) + item.quantity;
    });

    sale.payments.forEach((payment) => {
      const method = payment.method;
      if (paymentBreakdown[method]) {
        paymentBreakdown[method].count += 1;
        paymentBreakdown[method].amount += Number(payment.amount);
      } else {
        paymentBreakdown.OTRO.count += 1;
        paymentBreakdown.OTRO.amount += Number(payment.amount);
      }
    });
  });

  const topProducts = Object.entries(productCounts)
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const averageTicket = sales.length > 0 ? Number((totalAmount / sales.length).toFixed(2)) : 0;

  return {
    eventId,
    date,
    totalTransactions: sales.length,
    totalAmount: Number(totalAmount.toFixed(2)),
    totalUnits,
    averageTicket,
    paymentBreakdown,
    topProducts,
    recentSales: sales.slice(0, 15),
  };
}

/**
 * Genera un arqueo o cierre de caja diario
 */
export async function createCashClosingTransaction({
  tenantId,
  eventId,
  closedById,
  closingType = 'DIARIO',
  totalCashReported = 0,
  observations = null,
  date = null,
}) {
  const kpis = await getEventKPIs({ tenantId, eventId, date });

  const totalCashCalculated = kpis.paymentBreakdown.EFECTIVO.amount;
  const totalCard = kpis.paymentBreakdown.TARJETA.amount;
  const totalTransfer = kpis.paymentBreakdown.TRANSFERENCIA.amount;
  const cashDifference = Number((totalCashReported - totalCashCalculated).toFixed(2));

  const closing = await prisma.cashClosing.create({
    data: {
      tenantId,
      eventId,
      closedById,
      closingType,
      closingDate: date ? new Date(date) : new Date(),
      totalCashCalculated,
      totalCashReported,
      cashDifference,
      totalCard,
      totalTransfer,
      totalSalesCount: kpis.totalTransactions,
      grossTotal: kpis.totalAmount,
      observations,
      status: 'CONCILIADO',
    },
    include: {
      closedBy: { select: { fullName: true, email: true } },
      event: { select: { name: true } },
    },
  });

  return closing;
}

/**
 * Actualiza una venta existente con recálculo transaccional ACID
 */
export async function updateSaleTransaction({
  saleId,
  tenantId,
  userId,
  items,
  payments,
  discount,
  notes,
}) {
  return await prisma.$transaction(async (tx) => {
    // 1. Verificar existencia de la venta
    const existing = await tx.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { items: true, payments: true },
    });

    if (!existing) {
      throw new Error('Venta no encontrada o no pertenece a esta organización.');
    }

    let totalAmount = Number(existing.totalAmount);
    let newDiscount = discount !== undefined ? Number(discount) : Number(existing.discount);

    // 2. Si se actualizaron ítems, reconciliar renglones sin borrar en cascada y recalcular total
    if (items && items.length > 0) {
      let itemsTotal = 0;
      const matchedExistingIds = new Set();

      for (const item of items) {
        const subtotal = Number((item.quantity * item.unitPrice).toFixed(2));
        itemsTotal += subtotal;
        const trimmedDesc = item.description.trim();

        // Buscar correspondencia en ítems existentes para preservar ID y trazabilidad
        const existingItem = existing.items.find((ex) => {
          if (matchedExistingIds.has(ex.id)) return false;
          if (item.id && ex.id === item.id) return true;
          if (!item.id && item.productId && ex.productId === item.productId) return true;
          if (!item.id && !item.productId && ex.description.trim().toLowerCase() === trimmedDesc.toLowerCase()) return true;
          return false;
        });

        if (existingItem) {
          matchedExistingIds.add(existingItem.id);
          await tx.saleItem.update({
            where: { id: existingItem.id },
            data: {
              productId: item.productId || null,
              description: trimmedDesc,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal,
              // Preserva productionStatus, productionNotes y logs históricos en production_logs
            },
          });
        } else {
          await tx.saleItem.create({
            data: {
              saleId,
              productId: item.productId || null,
              description: trimmedDesc,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal,
              productionStatus: 'PENDIENTE',
            },
          });
        }
      }

      // Eliminar únicamente los ítems descartados de la venta
      const discardedItemIds = existing.items
        .filter((ex) => !matchedExistingIds.has(ex.id))
        .map((ex) => ex.id);

      if (discardedItemIds.length > 0) {
        await tx.saleItem.deleteMany({
          where: { id: { in: discardedItemIds } },
        });
      }

      totalAmount = Number(Math.max(0, itemsTotal - newDiscount).toFixed(2));
    } else if (discount !== undefined) {
      const itemsTotal = existing.items.reduce((acc, it) => acc + Number(it.subtotal), 0);
      totalAmount = Number(Math.max(0, itemsTotal - newDiscount).toFixed(2));
    }

    // 3. Si se actualizaron métodos de pago, reconstruir pagos
    if (payments && payments.length > 0) {
      await tx.salePayment.deleteMany({ where: { saleId } });
      await tx.salePayment.createMany({
        data: payments.map((p) => ({
          saleId,
          method: p.method,
          amount: p.amount !== undefined ? Number(p.amount) : totalAmount,
          reference: p.reference || null,
          receiptUrl: p.receiptUrl || null,
        })),
      });
    } else if (items || discount !== undefined) {
      // Ajustar monto del pago existente al nuevo total si no enviaron un desglose de pagos explícito
      if (existing.payments.length > 0) {
        await tx.salePayment.update({
          where: { id: existing.payments[0].id },
          data: { amount: totalAmount },
        });
      }
    }

    // 4. Actualizar registro maestro de la venta
    const updated = await tx.sale.update({
      where: { id: saleId },
      data: {
        totalAmount,
        discount: newDiscount,
        ...(notes !== undefined ? { notes } : {}),
      },
      include: {
        items: true,
        payments: true,
        seller: { select: { fullName: true, email: true } },
      },
    });

    // 5. Registro de auditoría inmutable
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: userId || existing.sellerId,
        action: 'VENTA_MODIFICADA',
        entity: 'sale',
        entityId: saleId,
        details: {
          saleNumber: existing.saleNumber,
          previousTotal: Number(existing.totalAmount),
          newTotal: Number(totalAmount),
          previousNotes: existing.notes,
          newNotes: notes,
          paymentMethod: updated.payments?.[0]?.method,
        },
      },
    });

    return updated;
  });
}

/**
 * Obtiene métricas consolidadas en tiempo real para el Monitor de Ventas de Gerencia
 */
export async function getMonitorDashboardMetrics({ tenantId, date = null }) {
  // 1. Obtener todos los eventos del negocio (priorizando activos)
  const events = await prisma.event.findMany({
    where: { tenantId },
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
  });

  // 2. Filtro de fecha para las ventas
  const salesWhere = {
    tenantId,
    status: 'COMPLETADA',
  };

  if (date) {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    salesWhere.createdAt = {
      gte: startOfDay,
      lte: endOfDay,
    };
  }

  const allSales = await prisma.sale.findMany({
    where: salesWhere,
    include: {
      payments: true,
      items: true,
      event: { select: { id: true, name: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Agrupar ventas por ID de evento
  const salesByEvent = {};
  allSales.forEach((sale) => {
    if (!salesByEvent[sale.eventId]) {
      salesByEvent[sale.eventId] = [];
    }
    salesByEvent[sale.eventId].push(sale);
  });

  // 3. Procesar detalle por evento
  const eventDetails = events.map((ev) => {
    const evSales = salesByEvent[ev.id] || [];
    let evTotal = 0;
    const payments = {
      TARJETA: { amount: 0, count: 0, percentage: 0 },
      TRANSFERENCIA: { amount: 0, count: 0, percentage: 0 },
      EFECTIVO: { amount: 0, count: 0, percentage: 0 },
    };

    evSales.forEach((s) => {
      evTotal += Number(s.totalAmount);
      s.payments.forEach((p) => {
        const m = p.method === 'TARJETA' ? 'TARJETA' : p.method === 'TRANSFERENCIA' ? 'TRANSFERENCIA' : 'EFECTIVO';
        payments[m].amount += Number(p.amount);
        payments[m].count += 1;
      });
    });

    if (evTotal > 0) {
      payments.TARJETA.percentage = Number(((payments.TARJETA.amount / evTotal) * 100).toFixed(1));
      payments.TRANSFERENCIA.percentage = Number(((payments.TRANSFERENCIA.amount / evTotal) * 100).toFixed(1));
      payments.EFECTIVO.percentage = Number(((payments.EFECTIVO.amount / evTotal) * 100).toFixed(1));
    }

    const lastSale = evSales[0]
      ? {
          amount: Number(evSales[0].totalAmount),
          time: new Date(evSales[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      : null;

    return {
      eventId: ev.id,
      name: ev.name,
      location: ev.location,
      status: ev.status,
      assignedSellerName: ev.assignedSellerName,
      assignedSellerEmail: ev.assignedSellerEmail,
      transactions: evSales.length,
      totalSold: Number(evTotal.toFixed(2)),
      lastSale,
      payments,
    };
  });

  // 4. Procesar Resumen General de la Jornada
  let grandTotal = 0;
  const globalPayments = {
    TARJETA: { amount: 0, count: 0, percentage: 0 },
    TRANSFERENCIA: { amount: 0, count: 0, percentage: 0 },
    EFECTIVO: { amount: 0, count: 0, percentage: 0 },
  };

  allSales.forEach((s) => {
    grandTotal += Number(s.totalAmount);
    s.payments.forEach((p) => {
      const m = p.method === 'TARJETA' ? 'TARJETA' : p.method === 'TRANSFERENCIA' ? 'TRANSFERENCIA' : 'EFECTIVO';
      globalPayments[m].amount += Number(p.amount);
      globalPayments[m].count += 1;
    });
  });

  if (grandTotal > 0) {
    globalPayments.TARJETA.percentage = Number(((globalPayments.TARJETA.amount / grandTotal) * 100).toFixed(1));
    globalPayments.TRANSFERENCIA.percentage = Number(((globalPayments.TRANSFERENCIA.amount / grandTotal) * 100).toFixed(1));
    globalPayments.EFECTIVO.percentage = Number(((globalPayments.EFECTIVO.amount / grandTotal) * 100).toFixed(1));
  }

  return {
    date: date || new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString(),
    eventDetails: eventDetails.filter((e) => e.status === 'ACTIVO' || e.transactions > 0),
    resumenGeneral: {
      totalTransactions: allSales.length,
      totalSold: Number(grandTotal.toFixed(2)),
      payments: globalPayments,
    },
  };
}
