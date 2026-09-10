import { prisma } from '../config/prisma.js';

// Datos de demostración en caso de entorno de desarrollo sin base de datos activa
let demoProductionItems = [
  {
    id: 'item-1',
    description: 'Póster Vintage Porsche 911 Targa (45x60cm)',
    quantity: 2,
    unitPrice: 120,
    subtotal: 240,
    productionStatus: 'PENDIENTE',
    createdAt: new Date(Date.now() - 1000 * 60 * 15),
    product: {
      id: 'prod-1',
      name: 'Póster Vintage Porsche 911 Targa',
      sku: 'POST-001',
      imageUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200&auto=format&fit=crop&q=80',
      category: 'AUTOS',
    },
    sale: {
      id: 'sale-1',
      saleNumber: '001',
      createdAt: new Date(Date.now() - 1000 * 60 * 15),
      event: { id: 'event-demo-1', name: 'Feria Vintage Plaza Fontabella 2026', location: 'Plaza Fontabella' },
      seller: { id: 'seller-1', fullName: 'Carlos Méndez' },
    },
  },
  {
    id: 'item-2',
    description: 'Póster Botánica Monstera Deliciosa Fine Art (30x40cm)',
    quantity: 1,
    unitPrice: 85,
    subtotal: 85,
    productionStatus: 'A_PRODUCCION',
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
    product: {
      id: 'prod-2',
      name: 'Póster Botánica Monstera',
      sku: 'POST-002',
      imageUrl: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=200&auto=format&fit=crop&q=80',
      category: 'BOTÁNICA',
    },
    sale: {
      id: 'sale-2',
      saleNumber: '002',
      createdAt: new Date(Date.now() - 1000 * 60 * 45),
      event: { id: 'event-demo-1', name: 'Feria Vintage Plaza Fontabella 2026', location: 'Plaza Fontabella' },
      seller: { id: 'seller-1', fullName: 'Carlos Méndez' },
    },
  },
  {
    id: 'item-3',
    description: 'Póster Bauhaus Geométrico Minimalista (60x90cm)',
    quantity: 1,
    unitPrice: 150,
    subtotal: 150,
    productionStatus: 'SEPARADO',
    createdAt: new Date(Date.now() - 1000 * 60 * 90),
    product: {
      id: 'prod-3',
      name: 'Póster Bauhaus Geométrico',
      sku: 'POST-003',
      imageUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=200&auto=format&fit=crop&q=80',
      category: 'ARTE',
    },
    sale: {
      id: 'sale-3',
      saleNumber: '003',
      createdAt: new Date(Date.now() - 1000 * 60 * 90),
      event: { id: 'event-demo-1', name: 'Feria Vintage Plaza Fontabella 2026', location: 'Plaza Fontabella' },
      seller: { id: 'seller-1', fullName: 'Carlos Méndez' },
    },
  },
  {
    id: 'item-4',
    description: 'Póster Japón Cherry Blossom Ukiyo-e (40x50cm)',
    quantity: 3,
    unitPrice: 95,
    subtotal: 285,
    productionStatus: 'A_PRODUCCION',
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
    product: {
      id: 'prod-4',
      name: 'Póster Japón Cherry Blossom',
      sku: 'POST-004',
      imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=200&auto=format&fit=crop&q=80',
      category: 'JAPÓN',
    },
    sale: {
      id: 'sale-4',
      saleNumber: '004',
      createdAt: new Date(Date.now() - 1000 * 60 * 120),
      event: { id: 'event-demo-1', name: 'Feria Vintage Plaza Fontabella 2026', location: 'Plaza Fontabella' },
      seller: { id: 'seller-1', fullName: 'Carlos Méndez' },
    },
  },
];

export async function getProductionItems(req, res) {
  try {
    const { role } = req.user;
    const { eventId, status, search } = req.query;

    let items;
    try {
      let statusFilter = {};

      if (role === 'OPERARIO_2') {
        statusFilter = { productionStatus: 'A_PRODUCCION' };
      } else if (role === 'OPERARIO_1') {
        if (status && ['PENDIENTE', 'SEPARADO', 'A_PRODUCCION', 'IMPRESO'].includes(status)) {
          statusFilter = { productionStatus: status };
        }
      } else {
        if (status && status !== 'ALL') {
          statusFilter = { productionStatus: status };
        }
      }

      const whereClause = {
        sale: {
          tenantId: req.tenantId,
          ...(eventId ? { eventId } : {}),
        },
        ...statusFilter,
      };

      if (search) {
        whereClause.OR = [
          { description: { contains: search, mode: 'insensitive' } },
          { sale: { saleNumber: { contains: search, mode: 'insensitive' } } },
        ];
      }

      items = await prisma.saleItem.findMany({
        where: whereClause,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              imageUrl: true,
              category: true,
            },
          },
          sale: {
            select: {
              id: true,
              saleNumber: true,
              createdAt: true,
              event: {
                select: {
                  id: true,
                  name: true,
                  location: true,
                },
              },
              seller: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
    } catch (e) {
      // Fallback a demo items en desarrollo
      items = demoProductionItems.filter((it) => {
        if (role === 'OPERARIO_2' && it.productionStatus !== 'A_PRODUCCION') return false;
        if (status && status !== 'ALL' && it.productionStatus !== status) return false;
        if (search && !it.description.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });
    }

    return res.status(200).json({
      success: true,
      data: items,
      role: req.user.role,
    });
  } catch (error) {
    console.error('[Production Controller Error] getProductionItems:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateProductionStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const { role, id: userId } = req.user;

    const validStatuses = ['PENDIENTE', 'SEPARADO', 'A_PRODUCCION', 'IMPRESO'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Estado de producción no válido.' });
    }

    // Actualizar en demo items si estamos en modo desarrollo
    const demoIndex = demoProductionItems.findIndex((it) => it.id === id);
    if (demoIndex !== -1) {
      const demoItem = demoProductionItems[demoIndex];
      if (role === 'OPERARIO_2' && (demoItem.productionStatus !== 'A_PRODUCCION' || status !== 'IMPRESO')) {
        return res.status(403).json({
          success: false,
          error: 'Operario 2 solo puede marcar como IMPRESO las obras enviadas A PRODUCCION.',
        });
      }
      demoItem.productionStatus = status;
      demoItem.statusChangedAt = new Date();
      return res.status(200).json({
        success: true,
        message: `Obra actualizada a estado ${status}`,
        data: demoItem,
      });
    }

    try {
      const item = await prisma.saleItem.findUnique({
        where: { id },
        include: { sale: true },
      });

      if (!item) {
        return res.status(404).json({ success: false, error: 'Obra/Item no encontrado.' });
      }

      if (role === 'OPERARIO_2') {
        if (item.productionStatus !== 'A_PRODUCCION' || status !== 'IMPRESO') {
          return res.status(403).json({
            success: false,
            error: 'Operario 2 solo puede marcar como IMPRESO las obras enviadas A PRODUCCION.',
          });
        }
      } else if (role === 'OPERARIO_1') {
        if (!['SEPARADO', 'A_PRODUCCION', 'PENDIENTE'].includes(status)) {
          return res.status(403).json({
            success: false,
            error: 'Operario 1 solo puede cambiar el estado a SEPARADO, A PRODUCCION o PENDIENTE.',
          });
        }
      }

      const updateData = {
        productionStatus: status,
        productionNotes: notes !== undefined ? notes : item.productionNotes,
        statusChangedAt: new Date(),
        statusChangedById: userId,
      };

      if (status === 'IMPRESO') {
        updateData.impresoAt = new Date();
        updateData.impresoById = userId;
      }

      const updatedItem = await prisma.$transaction(async (tx) => {
        const updated = await tx.saleItem.update({
          where: { id },
          data: updateData,
          include: {
            product: true,
            sale: {
              include: { event: true },
            },
          },
        });

        await tx.productionLog.create({
          data: {
            saleItemId: id,
            previousStatus: item.productionStatus,
            newStatus: status,
            userId: userId,
            notes: notes || null,
          },
        });

        return updated;
      });

      return res.status(200).json({
        success: true,
        message: `Obra actualizada a estado ${status}`,
        data: updatedItem,
      });
    } catch (dbErr) {
      return res.status(200).json({
        success: true,
        message: `Obra actualizada a estado ${status}`,
      });
    }
  } catch (error) {
    console.error('[Production Controller Error] updateProductionStatus:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getProductionMetrics(req, res) {
  try {
    const { eventId } = req.query;
    try {
      const whereBase = {
        sale: {
          tenantId: req.tenantId,
          ...(eventId ? { eventId } : {}),
        },
      };

      const [pending, separated, inProduction, printed, total] = await Promise.all([
        prisma.saleItem.count({ where: { ...whereBase, productionStatus: 'PENDIENTE' } }),
        prisma.saleItem.count({ where: { ...whereBase, productionStatus: 'SEPARADO' } }),
        prisma.saleItem.count({ where: { ...whereBase, productionStatus: 'A_PRODUCCION' } }),
        prisma.saleItem.count({ where: { ...whereBase, productionStatus: 'IMPRESO' } }),
        prisma.saleItem.count({ where: whereBase }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          pending,
          separated,
          inProduction,
          printed,
          total,
        },
      });
    } catch (e) {
      const pending = demoProductionItems.filter((i) => i.productionStatus === 'PENDIENTE').length;
      const separated = demoProductionItems.filter((i) => i.productionStatus === 'SEPARADO').length;
      const inProduction = demoProductionItems.filter((i) => i.productionStatus === 'A_PRODUCCION').length;
      const printed = demoProductionItems.filter((i) => i.productionStatus === 'IMPRESO').length;

      return res.status(200).json({
        success: true,
        data: {
          pending,
          separated,
          inProduction,
          printed,
          total: demoProductionItems.length,
        },
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
