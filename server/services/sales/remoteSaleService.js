import { prisma } from '../../config/prisma.js';
import { generateSaleNumber } from './saleNumberGenerator.js';
import { validateOfficialItemPrice } from '../catalog/catalogSizeResolver.js';
import { normalizeWebOrderNumber, notifyWebOrderStatus } from './webOrderInboxService.js';

/**
 * Busca o crea un cliente CRM de forma atómica e idempotente por (tenantId, phone).
 */
export async function findOrCreateCustomer(tenantId, customerData, tx = prisma) {
  const client = tx || prisma;
  const phone = customerData.phone?.trim();
  if (!phone) throw new Error('El número de teléfono/WhatsApp es requerido para gestionar el cliente.');

  const existing = await client.customer.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
  });

  if (existing) {
    const fields = ['fullName', 'deliveryAddress', 'department', 'municipality', 'email'];
    const updateData = {};
    for (const f of fields) {
      if (customerData[f] && customerData[f].trim() !== existing[f]) updateData[f] = customerData[f].trim();
    }
    return Object.keys(updateData).length > 0
      ? await client.customer.update({ where: { id: existing.id }, data: updateData })
      : existing;
  }

  try {
    return await client.customer.create({
      data: {
        tenantId,
        fullName: customerData.fullName?.trim(),
        phone,
        email: customerData.email?.trim() || null,
        deliveryAddress: customerData.deliveryAddress?.trim() || null,
        department: customerData.department?.trim() || null,
        municipality: customerData.municipality?.trim() || null,
        sourceChannel: customerData.sourceChannel || 'WHATSAPP',
        notes: customerData.notes?.trim() || null,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const recovered = await client.customer.findUnique({
        where: { tenantId_phone: { tenantId, phone } },
      });
      if (recovered) return recovered;
    }
    throw err;
  }
}

export async function createCustomer({ tenantId, customerData }) {
  const phone = customerData.phone?.trim();
  const existing = await prisma.customer.findUnique({ where: { tenantId_phone: { tenantId, phone } } });
  if (existing) {
    const error = new Error(`Ya existe un cliente registrado con el número de teléfono/WhatsApp ${phone}`);
    error.statusCode = 409;
    throw error;
  }
  return await prisma.customer.create({
    data: {
      tenantId,
      fullName: customerData.fullName.trim(),
      phone,
      email: customerData.email?.trim() || null,
      deliveryAddress: customerData.deliveryAddress?.trim() || null,
      department: customerData.department?.trim() || null,
      municipality: customerData.municipality?.trim() || null,
      sourceChannel: customerData.sourceChannel || 'WHATSAPP',
      notes: customerData.notes?.trim() || null,
    },
  });
}

export async function getCustomersList({ tenantId, query, phone, page = 1, limit = 50, offset = undefined }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const take = Math.min(Math.max(1, Number(limit) || 50), 100);
  const skip = offset !== undefined ? Math.max(0, Number(offset) || 0) : (pageNum - 1) * take;
  const where = { tenantId };
  if (phone) {
    where.phone = { contains: phone.trim() };
  } else if (query) {
    const trimmed = query.trim();
    where.OR = [
      { fullName: { contains: trimmed, mode: 'insensitive' } },
      { phone: { contains: trimmed } },
    ];
  }
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { _count: { select: { sales: true } } } }),
    prisma.customer.count({ where }),
  ]);
  return { customers, total, page: pageNum, limit: take, totalPages: Math.ceil(total / take) };
}

export async function getCustomerById({ tenantId, customerId }) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    include: { sales: { orderBy: { createdAt: 'desc' }, include: { items: true, payments: true } } },
  });
  if (!customer) {
    const error = new Error('Cliente no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const validSales = customer.sales.filter((s) => s.status !== 'ANULADA');
  const totalOrders = validSales.length;
  const ltv = validSales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
  const pendingBalance = validSales.reduce((acc, s) => acc + Number(s.balanceDue), 0);
  const lastOrderDate = validSales.length > 0 ? validSales[0].createdAt : null;
  return {
    customer,
    metrics: { totalOrders, ltv: Number(ltv.toFixed(2)), pendingBalance: Number(pendingBalance.toFixed(2)), lastOrderDate },
  };
}

async function findExistingRemoteSaleByKey(client, tenantId, idempotencyKey) {
  const include = { items: true, payments: true, customer: true, seller: { select: { id: true, fullName: true, email: true } } };
  if (typeof client.sale?.findFirst === 'function') {
    return await client.sale.findFirst({ where: { tenantId, idempotencyKey }, include });
  }
  if (typeof client.sale?.findUnique === 'function') {
    return await client.sale.findUnique({ where: { idempotencyKey }, include });
  }
  return null;
}

/**
 * Transacción ACID para registro de Venta Remota con anticipo libre (> 0) o pendiente de pago.
 */
export async function createRemoteSaleTransaction({ tenantId, sellerId, data, idempotencyKey = null }) {
  // Fast-Path Idempotencia RFC 7231
  if (idempotencyKey) {
    const existingSale = await findExistingRemoteSaleByKey(prisma, tenantId, idempotencyKey);
    if (existingSale) return { ...existingSale, idempotentReplay: true };
  }

  const eventId = data.eventId || 'evt-ventas-redes-online';

  const rawEditionCost = Number(data.editionCost ?? 0);
  if (!Number.isFinite(rawEditionCost) || rawEditionCost < 0) {
    const error = new Error('El costo de edición no puede ser negativo.');
    error.statusCode = 400;
    throw error;
  }
  const editionCost = Number(rawEditionCost.toFixed(2));
  const editionDescription = typeof data.editionDescription === 'string' ? data.editionDescription.trim() : '';
  if (editionCost > 0 && !editionDescription) {
    const error = new Error('La descripción de la edición es obligatoria cuando se cobra un costo de edición.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Aritmética Financiera Estricta y Validación de Precios
  const itemsData = data.items.map((item) => {
    validateOfficialItemPrice(item);
    const existingProdNote = typeof item.productionNotes === 'string' ? item.productionNotes.trim() : '';
    const editionProdNote = editionDescription ? `[Edición]: ${editionDescription}` : '';
    const mergedProductionNotes = [existingProdNote, editionProdNote].filter(Boolean).join(' • ') || null;
    return {
      productId: item.productId || null,
      description: item.description.trim(),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: Number((item.quantity * item.unitPrice).toFixed(2)),
      isCustom: Boolean(item.isCustom),
      material: item.material || null,
      customDimensions: item.customDimensions || null,
      customImageUrl: item.customImageUrl || null,
      productionNotes: mergedProductionNotes,
      productionStatus: 'PENDIENTE',
    };
  });

  const itemsSubtotal = itemsData.reduce((acc, item) => acc + item.subtotal, 0);
  const discount = Number(data.discount || 0);
  const productsAmount = Math.max(0, Number((itemsSubtotal - discount).toFixed(2)));
  const shippingCost = Number(data.shippingCost || 0);
  const totalAmount = Number((productsAmount + editionCost + shippingCost).toFixed(2));
  const paymentsList = Array.isArray(data.payments) ? data.payments : [];
  const paymentsTotal = Number(paymentsList.reduce((acc, p) => acc + Number(p.amount), 0).toFixed(2));
  const isZeroPayment = paymentsList.length === 0 || paymentsTotal === 0;

  let paymentStatus;
  let depositAmount;
  let balanceDue;
  let status;
  let itemProductionStatus;

  if (isZeroPayment) {
    paymentStatus = 'PENDIENTE_PAGO';
    depositAmount = 0.0;
    balanceDue = totalAmount;
    status = 'PENDIENTE';
    itemProductionStatus = 'PENDIENTE';
  } else {
    if (paymentsTotal <= 0) {
      const error = new Error('El valor del anticipo debe ser mayor a Q 0.00.');
      error.statusCode = 400;
      throw error;
    }

    if (paymentsTotal > totalAmount + 0.01) {
      const error = new Error(
        `El monto de pago registrado (Q ${paymentsTotal.toFixed(2)}) no puede superar el total de la orden (Q ${totalAmount.toFixed(2)}).`
      );
      error.statusCode = 400;
      throw error;
    }

    const isFullPayment = Math.abs(paymentsTotal - totalAmount) < 0.005 || paymentsTotal >= totalAmount;
    paymentStatus = isFullPayment ? 'PAGADO_TOTAL' : 'ANTICIPO_PAGADO';
    depositAmount = isFullPayment ? totalAmount : paymentsTotal;
    balanceDue = isFullPayment ? 0.0 : Number((totalAmount - paymentsTotal).toFixed(2));
    status = isFullPayment ? 'COMPLETADA' : 'PENDIENTE';
    itemProductionStatus = 'A_PRODUCCION';
  }

  // Asignar el estado de producción correspondiente a los ítems
  itemsData.forEach((it) => { it.productionStatus = itemProductionStatus; });

  const rawWebOrderInboxId = typeof data.webOrderInboxId === 'string' && data.webOrderInboxId.trim()
    ? data.webOrderInboxId.trim()
    : null;
  const rawWebOrderNumber = normalizeWebOrderNumber(data.webOrderNumber);

  try {
    const committedSale = await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await findExistingRemoteSaleByKey(tx, tenantId, idempotencyKey);
        if (existing) return { ...existing, idempotentReplay: true };
      }

      let inboxOrder = null;
      if (rawWebOrderInboxId || rawWebOrderNumber) {
        if (rawWebOrderInboxId && typeof tx.webOrderInbox?.findFirst === 'function') {
          inboxOrder = await tx.webOrderInbox.findFirst({ where: { id: rawWebOrderInboxId, tenantId } });
          if (!inboxOrder) {
            const notFoundErr = new Error('El pedido web seleccionado no existe en la bandeja de esta empresa.');
            notFoundErr.statusCode = 404;
            throw notFoundErr;
          }
        } else if (rawWebOrderNumber && typeof tx.webOrderInbox?.findFirst === 'function') {
          inboxOrder = await tx.webOrderInbox.findFirst({ where: { tenantId, orderNumber: rawWebOrderNumber } });
        }

        if (inboxOrder && inboxOrder.status === 'IMPORTADO') {
          const dupErr = new Error(
            `El pedido web #${inboxOrder.orderNumber} ya fue importado previamente (${inboxOrder.importedSaleNumber || 'venta registrada'}).`
          );
          dupErr.statusCode = 409;
          throw dupErr;
        }
      }

      const resolvedWebOrderNumber = inboxOrder?.orderNumber || rawWebOrderNumber || null;

      let finalCustomerId = data.customerId || null;
      if (data.customer) {
        const customerRecord = await findOrCreateCustomer(tenantId, data.customer, tx);
        finalCustomerId = customerRecord.id;
      }

      const saleNumber = await generateSaleNumber(eventId, tx);
      const baseNotes = typeof data.notes === 'string' ? data.notes.trim() : '';
      const webOriginTag = resolvedWebOrderNumber ? `[Origen Web: #${resolvedWebOrderNumber}]` : '';
      const shouldAppendWebTag = Boolean(webOriginTag && !baseNotes.includes(webOriginTag));
      const editionNoteStamp = (editionCost > 0 || editionDescription)
        ? `[Edición (+Q ${editionCost.toFixed(2)}): ${editionDescription || 'Edición personalizada'}]`
        : '';
      const combinedSaleNotes = [
        baseNotes,
        shouldAppendWebTag ? webOriginTag : '',
        editionNoteStamp,
      ].filter(Boolean).join('\n') || null;

      const sale = await tx.sale.create({
        data: {
          tenantId,
          eventId,
          sellerId,
          saleNumber,
          totalAmount,
          discount,
          notes: combinedSaleNotes,
          status,
          inputChannel: 'REDES_SOCIALES',
          idempotencyKey: idempotencyKey || null,
          orderType: 'REDES_PERSONALIZADO',
          deliveryMethod: data.deliveryMethod,
          shippingCost,
          shippingCourier: data.shippingCourier || null,
          shippingTrackingNumber: data.shippingTrackingNumber || null,
          pickupEventId: data.pickupEventId || null,
          customerId: finalCustomerId,
          paymentStatus,
          depositAmount,
          balanceDue,
          items: { create: itemsData },
          payments: {
            create: paymentsList.map((p) => ({
              method: p.method, amount: p.amount, reference: p.reference || null, receiptUrl: p.receiptUrl || null,
            })),
          },
        },
        include: {
          items: true,
          payments: true,
          customer: true,
          seller: { select: { id: true, fullName: true, email: true } },
        },
      });

      if (inboxOrder) {
        if (typeof tx.webOrderInbox?.updateMany === 'function') {
          const lockGuard = await tx.webOrderInbox.updateMany({
            where: {
              id: inboxOrder.id,
              tenantId,
              status: { not: 'IMPORTADO' },
            },
            data: {
              status: 'IMPORTADO',
              importedSaleId: sale.id,
              importedSaleNumber: sale.saleNumber,
              importedById: sellerId,
              importedAt: new Date(),
            },
          });
          if (!lockGuard || lockGuard.count === 0) {
            const raceErr = new Error(
              `El pedido web #${inboxOrder.orderNumber} acaba de ser importado por otra operación concurrente.`
            );
            raceErr.statusCode = 409;
            throw raceErr;
          }
        } else if (typeof tx.webOrderInbox?.update === 'function') {
          await tx.webOrderInbox.update({
            where: { id: inboxOrder.id },
            data: {
              status: 'IMPORTADO',
              importedSaleId: sale.id,
              importedSaleNumber: sale.saleNumber,
              importedById: sellerId,
              importedAt: new Date(),
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId, userId: sellerId, action: 'VENTA_REMOTA_REGISTRADA', entity: 'sale', entityId: sale.id,
          details: {
            saleNumber,
            totalAmount,
            depositAmount,
            balanceDue,
            paymentStatus,
            customerId: finalCustomerId,
            editionCost,
            editionDescription: editionDescription || null,
            webOrderInboxId: inboxOrder?.id || null,
            webOrderNumber: resolvedWebOrderNumber,
          },
        },
      });

      return {
        ...sale,
        editionCost,
        editionDescription: editionDescription || null,
        webOrderInboxId: inboxOrder?.id || null,
        webOrderNumber: resolvedWebOrderNumber,
      };
    }, { maxWait: 15000, timeout: 30000 });

    if (!committedSale.idempotentReplay && committedSale.webOrderNumber) {
      await notifyWebOrderStatus({
        orderNumber: committedSale.webOrderNumber,
        status: 'IMPORTADO',
        externalSaleNumber: committedSale.saleNumber,
      });
    }

    return committedSale;
  } catch (err) {
    if (
      idempotencyKey &&
      (err.code === 'P2002' ||
        err.message?.includes('idempotencyKey') ||
        err.message?.includes('sales_idempotencyKey_key') ||
        err.message?.includes('sales_tenantId_idempotencyKey_key'))
    ) {
      const existing = await findExistingRemoteSaleByKey(prisma, tenantId, idempotencyKey);
      if (existing) return { ...existing, idempotentReplay: true };
    }
    throw err;
  }
}

export const createRemoteOrder = createRemoteSaleTransaction;

/**
 * Cobro y liquidación del saldo adeudado para despacho/entrega.
 */
export async function registerBalancePayment({
  saleId,
  tenantId,
  sellerId,
  payments,
  notes = null,
  idempotencyKey = null,
  userRole = null,
  userRoles = null,
  assignedEventId = null,
  tx = null,
}) {
  const executeOperation = async (client) => {
    const sale = await client.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { items: true, payments: true, customer: true, seller: { select: { id: true, fullName: true, email: true } } },
    });

    if (!sale) {
      const error = new Error('Venta no encontrada');
      error.statusCode = 404;
      throw error;
    }

    const roles = Array.isArray(userRoles) && userRoles.length > 0 ? userRoles : (userRole ? [userRole] : []);
    const isPrivileged = roles.includes('SUPER_ADMIN') || roles.includes('VENDEDOR_REDES');
    if (assignedEventId && !isPrivileged && sale.orderType !== 'REDES_PERSONALIZADO' && sale.eventId !== assignedEventId && sale.pickupEventId !== assignedEventId) {
      const error = new Error('No tienes permiso para cobrar el saldo de una venta fuera de tu evento asignado.');
      error.statusCode = 403;
      throw error;
    }

    if (idempotencyKey) {
      const existingInSale = Array.isArray(sale.payments)
        ? sale.payments.find((p) => p.idempotencyKey === idempotencyKey)
        : null;
      const existingPayment = existingInSale || (typeof client.salePayment?.findFirst === 'function'
        ? await client.salePayment.findFirst({ where: { saleId: sale.id, idempotencyKey } })
        : null);
      if (existingPayment) {
        return { ...sale, idempotentReplay: true };
      }
    }

    if (sale.status === 'ANULADA') {
      const error = new Error('No se puede cobrar el saldo de una venta anulada');
      error.statusCode = 400;
      throw error;
    }

    const currentBalance = Number(sale.balanceDue);
    if (currentBalance <= 0) {
      const error = new Error(`La venta #${sale.saleNumber} ya se encuentra completamente liquidada (saldo Q 0.00)`);
      error.statusCode = 400;
      throw error;
    }

    const newPaymentsTotal = Number(payments.reduce((acc, p) => acc + Number(p.amount), 0).toFixed(2));
    const isPendingPayment = sale.paymentStatus === 'PENDIENTE_PAGO';
    let newPaymentStatus;
    let newStatus;
    let newBalanceDue;
    let newDepositAmount;

    if (isPendingPayment) {
      if (newPaymentsTotal <= 0) {
        const error = new Error('El valor del anticipo debe ser mayor a Q 0.00.');
        error.statusCode = 400;
        throw error;
      }
      if (newPaymentsTotal > currentBalance + 0.05) {
        const error = new Error(
          `El monto pagado (Q ${newPaymentsTotal.toFixed(2)}) supera el saldo adeudado de la orden (Q ${currentBalance.toFixed(2)})`
        );
        error.statusCode = 400;
        throw error;
      }

      const isFull = Math.abs(newPaymentsTotal - currentBalance) <= 0.05 || newPaymentsTotal >= currentBalance;
      if (isFull) {
        newPaymentStatus = 'PAGADO_TOTAL'; newStatus = 'COMPLETADA'; newBalanceDue = 0.0; newDepositAmount = Number(sale.totalAmount);
      } else {
        newPaymentStatus = 'ANTICIPO_PAGADO'; newStatus = 'PENDIENTE'; newBalanceDue = Number((Number(sale.totalAmount) - newPaymentsTotal).toFixed(2)); newDepositAmount = newPaymentsTotal;
      }
    } else {
      if (Number(Math.abs(newPaymentsTotal - currentBalance).toFixed(2)) > 0.05) {
        const error = new Error(`El monto pagado (Q ${newPaymentsTotal.toFixed(2)}) no coincide con el saldo adeudado de la orden (Q ${currentBalance.toFixed(2)})`);
        error.statusCode = 400;
        throw error;
      }
      newPaymentStatus = 'PAGADO_TOTAL'; newStatus = 'COMPLETADA'; newBalanceDue = 0.0; newDepositAmount = Number(sale.totalAmount);
    }

    let collectorUser = null;
    if (sellerId && typeof client.user?.findUnique === 'function') {
      try {
        collectorUser = await client.user.findUnique({
          where: { id: sellerId },
          select: { id: true, fullName: true, role: true },
        });
      } catch (_) {}
    }
    const collectorName = collectorUser?.fullName || 'Usuario';
    const collectorRole = collectorUser?.role || userRole || 'STAFF';

    const auditStamp = isPendingPayment
      ? `[Anticipo Q${newPaymentsTotal.toFixed(2)} registrado por: ${collectorName} (${collectorRole})]`
      : `[Saldo Q${newPaymentsTotal.toFixed(2)} cobrado por: ${collectorName} (${collectorRole})]`;
    const labelNote = isPendingPayment ? 'Anticipo registrado' : 'Saldo cobrado';
    const userNote = notes ? `[${labelNote}]: ${notes}` : '';
    const notePieces = [auditStamp, userNote].filter(Boolean).join(' • ');
    const updatedNotes = sale.notes ? `${sale.notes}\n${notePieces}` : notePieces;
    const shouldAssignPickup = Boolean(assignedEventId && !sale.pickupEventId);

    // Protección atómica contra condiciones de carrera concurrentes (TOCTOU)
    if (typeof client.sale?.updateMany === 'function') {
      const atomicGuard = await client.sale.updateMany({
        where: { id: sale.id, tenantId, balanceDue: { gte: Number((newPaymentsTotal - 0.05).toFixed(2)) } },
        data: {
          balanceDue: newBalanceDue, depositAmount: newDepositAmount, paymentStatus: newPaymentStatus, status: newStatus, notes: updatedNotes,
          ...(shouldAssignPickup ? { pickupEventId: assignedEventId } : {}),
        },
      });
      if (atomicGuard && typeof atomicGuard.count === 'number' && atomicGuard.count === 0) {
        const error = new Error('El saldo de este pedido ya fue liquidado o modificado por otra operación concurrente.');
        error.statusCode = 409;
        throw error;
      }
    }

    if (isPendingPayment) {
      const saleItems = await client.saleItem.findMany({ where: { saleId: sale.id }, select: { id: true, productionStatus: true } });
      await client.saleItem.updateMany({
        where: { saleId: sale.id },
        data: { productionStatus: 'A_PRODUCCION', statusChangedAt: new Date(), statusChangedById: sellerId || null },
      });
      if (saleItems.length > 0) {
        await client.productionLog.createMany({
          data: saleItems.map((it) => ({
            saleItemId: it.id, previousStatus: it.productionStatus, newStatus: 'A_PRODUCCION', userId: sellerId || null,
            notes: `Activación a taller por acreditación de depósito (Q ${newPaymentsTotal.toFixed(2)})`,
          })),
        });
      }
    }

    const isStandPickupCollection = Boolean(
      newBalanceDue <= 0 &&
      ((assignedEventId && assignedEventId !== 'evt-ventas-redes-online') ||
        (sale.pickupEventId && sale.pickupEventId !== 'evt-ventas-redes-online'))
    );

    await client.salePayment.createMany({
      data: payments.map((p, idx) => {
        let paymentRef = p.reference ? p.reference.trim() : null;
        if (!isPendingPayment || isStandPickupCollection) {
          paymentRef = paymentRef ? `${paymentRef} [SALDO]` : '[SALDO]';
        }
        return {
          saleId: sale.id,
          method: p.method,
          amount: p.amount,
          reference: paymentRef,
          receiptUrl: p.receiptUrl || null,
          idempotencyKey: idempotencyKey ? (idx === 0 ? idempotencyKey : `${idempotencyKey}-${idx}`) : null,
        };
      }),
    });

    const updatedSale = await client.sale.update({
      where: { id: sale.id },
      data: {
        balanceDue: newBalanceDue, depositAmount: newDepositAmount, paymentStatus: newPaymentStatus, status: newStatus, notes: updatedNotes,
        ...(shouldAssignPickup ? { pickupEventId: assignedEventId } : {}),
      },
      include: { items: true, payments: true, customer: true, seller: { select: { id: true, fullName: true, email: true } } },
    });

    await client.auditLog.create({
      data: {
        tenantId,
        userId: sellerId,
        action: isPendingPayment ? 'ANTICIPO_VENTA_REGISTRADO' : 'SALDO_VENTA_COBRADO',
        entity: 'sale',
        entityId: sale.id,
        details: {
          saleNumber: sale.saleNumber,
          paidAmount: newPaymentsTotal,
          previousBalance: currentBalance,
          newPaymentStatus,
          activatedToProduction: isPendingPayment,
          collectorName,
          collectorRole,
        },
      },
    });

    if (newBalanceDue <= 0) {
      const standPayments = (updatedSale?.payments || []).filter((p) => String(p.reference || '').includes('[SALDO]'));
      return {
        ...updatedSale,
        balanceCollectedById: sellerId || null,
        standCollectedAmount: newPaymentsTotal,
        standCollectedAt: standPayments[standPayments.length - 1]?.createdAt || new Date().toISOString(),
        standCollectedPayments: standPayments.length > 0 ? standPayments : payments,
      };
    }

    return updatedSale;
  };

  if (tx) return await executeOperation(tx);
  return await prisma.$transaction(executeOperation, { maxWait: 15000, timeout: 30000 });
}
