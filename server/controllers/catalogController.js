import { prisma } from '../config/prisma.js';

export async function getActiveEvent(req, res) {
  try {
    const tenantId = req.tenantId;

    let event = await prisma.event.findFirst({
      where: { tenantId, status: 'ACTIVO' },
      include: {
        tenant: {
          select: { name: true, currencySymbol: true, currency: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    if (!event) {
      event = await prisma.event.findFirst({
        where: { tenantId },
        include: {
          tenant: { select: { name: true, currencySymbol: true, currency: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!event) {
      return res.status(404).json({ success: false, error: 'No hay eventos configurados para este negocio.' });
    }

    return res.json({ success: true, data: event });
  } catch (err) {
    console.error('❌ Error obteniendo evento activo:', err);
    return res.status(500).json({ success: false, error: 'Error del servidor al obtener evento.' });
  }
}

export async function getProducts(req, res) {
  try {
    const tenantId = req.tenantId;
    const products = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ category: 'asc' }, { basePrice: 'asc' }],
    });

    return res.json({ success: true, data: products, count: products.length });
  } catch (err) {
    console.error('❌ Error obteniendo productos:', err);
    return res.status(500).json({ success: false, error: 'Error al obtener catálogo de productos.' });
  }
}

export async function getEventsList(req, res) {
  try {
    const tenantId = req.tenantId;
    const events = await prisma.event.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      include: {
        _count: {
          select: { sales: true },
        },
        sales: {
          select: { totalAmount: true },
        },
      },
    });

    const formatted = events.map((ev) => {
      const totalSold = ev.sales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
      const { sales, ...rest } = ev;
      return {
        ...rest,
        totalSold,
        salesCount: ev._count.sales,
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('❌ Error obteniendo lista de eventos:', err);
    return res.status(500).json({ success: false, error: 'Error al obtener eventos.' });
  }
}

export async function activateEvent(req, res) {
  try {
    const { id } = req.params;
    const { assignedSellerEmail, assignedSellerName } = req.body;
    const tenantId = req.tenantId;

    if (!assignedSellerEmail || !assignedSellerEmail.trim()) {
      return res.status(400).json({ success: false, error: 'El correo de Google del vendedor es obligatorio.' });
    }

    // 1. Poner en CONFIRMADO cualquier otro evento activo del tenant
    await prisma.event.updateMany({
      where: { tenantId, status: 'ACTIVO', id: { not: id } },
      data: { status: 'CONFIRMADO' },
    });

    // 2. Activar este evento y asignar vendedor
    const updated = await prisma.event.update({
      where: { id },
      data: {
        status: 'ACTIVO',
        assignedSellerEmail: assignedSellerEmail.trim(),
        assignedSellerName: (assignedSellerName || assignedSellerEmail.split('@')[0]).trim(),
      },
    });

    return res.json({
      success: true,
      data: updated,
      message: `El evento "${updated.name}" está ahora EN CURSO con vendedor ${updated.assignedSellerEmail}.`,
    });
  } catch (err) {
    console.error('❌ Error activando evento:', err);
    return res.status(500).json({ success: false, error: 'Error al activar el evento.' });
  }
}

export async function createEvent(req, res) {
  try {
    const tenantId = req.tenantId;
    const { name, location, startDate, endDate, salesTarget, assignedSellerEmail, assignedSellerName } = req.body;

    if (!name || !location) {
      return res.status(400).json({ success: false, error: 'Nombre y ubicación son obligatorios.' });
    }

    const newEvent = await prisma.event.create({
      data: {
        tenantId,
        name: name.trim(),
        location: location.trim(),
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 3 * 86400000),
        status: 'CONFIRMADO',
        salesTarget: salesTarget ? Number(salesTarget) : 15000,
        assignedSellerEmail: assignedSellerEmail ? assignedSellerEmail.trim() : null,
        assignedSellerName: assignedSellerName ? assignedSellerName.trim() : null,
      },
    });

    return res.status(201).json({
      success: true,
      data: newEvent,
      message: 'Evento confirmado registrado exitosamente.',
    });
  } catch (err) {
    console.error('❌ Error creando evento:', err);
    return res.status(500).json({ success: false, error: 'Error al crear nuevo evento.' });
  }
}

import { searchWebPosters } from '../services/webCatalogService.js';
import { syncCatalogFromWeb } from '../services/catalogSyncService.js';

export async function searchWebPostersCatalog(req, res) {
  try {
    const { q, category, limit } = req.query;
    const results = await searchWebPosters({
      tenantId: req.tenantId,
      query: q || '',
      category: category || null,
      limit: limit ? parseInt(limit, 10) : 24,
    });

    return res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    console.error('❌ Error buscando pósters web:', err);
    return res.status(500).json({ success: false, error: 'Error en la búsqueda del catálogo web.' });
  }
}

export async function triggerCatalogSync(req, res) {
  try {
    const tenantId = req.tenantId;
    const result = await syncCatalogFromWeb(tenantId);
    return res.status(200).json({
      success: result.success,
      count: result.count,
      message: result.success
        ? `Sincronización exitosa: ${result.count} productos actualizados.`
        : `Sincronización finalizada: ${result.warning || result.error}`,
      data: result,
    });
  } catch (err) {
    console.error('❌ Error en sincronización de catálogo:', err);
    return res.status(500).json({
      success: false,
      error: 'Error interno al sincronizar el catálogo.',
    });
  }
}
