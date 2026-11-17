import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secure_production_feat016_jwt_secret_2026';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS || 'superadmin@dekolabs.org';

const { prisma } = await import('../../server/config/prisma.js');
const {
  getProductionItems,
  updateItemProductionStatus,
  getProductionMetrics,
} = await import('../../server/services/productionService.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

/**
 * Importa dinámicamente las funciones puras reales definidas en ProductionOrderCard.jsx
 * truncando únicamente el componente JSX final para ejecutarlas nativamente en Node ESM.
 */
async function loadCardPureHelpers() {
  const cardPath = path.join(ROOT, 'src/components/production/ProductionOrderCard.jsx');
  const source = fs.readFileSync(cardPath, 'utf8');
  const splitIdx = source.indexOf('export default function ProductionOrderCard');
  assert.ok(splitIdx > 0, 'ProductionOrderCard.jsx debe exportar por defecto ProductionOrderCard');
  const headerOnly = source
    .slice(0, splitIdx)
    .replace(/^import\s+React[^\n]*\n/m, '')
    .replace(/^import\s+\{[^}]*\}\s+from\s+['"]lucide-react['"];?\n/m, '');
  const dataUrl = `data:text/javascript;base64,${Buffer.from(headerOnly, 'utf8').toString('base64')}`;
  return import(dataUrl);
}

/**
 * Arnés en memoria fiel al comportamiento relacional de Prisma para Sale, SaleItem, ProductionLog y User.
 */
function installProductionPrismaHarness({ initialSales = [], initialItems = [], users = {} } = {}) {
  const salesMap = new Map(initialSales.map((s) => [s.id, { ...s }]));
  const usersMap = new Map(
    Object.entries(users).map(([id, u]) => [id, { id, fullName: u.fullName, email: u.email }])
  );
  const state = {
    items: initialItems.map((it) => ({
      productionStatus: 'PENDIENTE',
      productionNotes: null,
      customDimensions: null,
      isCustom: false,
      quantity: 1,
      unitPrice: 65,
      createdAt: new Date('2026-11-16T15:00:00.000Z'),
      statusChangedAt: null,
      statusChangedById: null,
      impresoAt: null,
      impresoById: null,
      ...it,
    })),
    logs: [],
    auditLogs: [],
  };

  const originals = {
    itemCount: prisma.saleItem.count,
    itemFindMany: prisma.saleItem.findMany,
    itemFindUnique: prisma.saleItem.findUnique,
    itemUpdate: prisma.saleItem.update,
    prodLogCreate: prisma.productionLog.create,
    auditLogCreate: prisma.auditLog.create,
    transaction: prisma.$transaction,
  };

  const matchesSaleCondition = (sale, saleCond = {}) => {
    if (!sale) return false;
    if (saleCond.tenantId && sale.tenantId !== saleCond.tenantId) return false;
    if (saleCond.eventId && sale.eventId !== saleCond.eventId) return false;
    if (saleCond.sellerId && sale.sellerId !== saleCond.sellerId) return false;
    if (saleCond.orderType && sale.orderType !== saleCond.orderType) return false;
    if (saleCond.status?.not && sale.status === saleCond.status.not) return false;
    if (typeof saleCond.status === 'string' && sale.status !== saleCond.status) return false;
    if (saleCond.NOT) {
      const notEntries = Object.entries(saleCond.NOT);
      const allNotMatch = notEntries.every(([k, v]) => sale[k] === v);
      if (allNotMatch) return false;
    }
    return true;
  };

  const matchesItemWhere = (item, where = {}) => {
    const sale = salesMap.get(item.saleId);
    if (where.sale && !matchesSaleCondition(sale, where.sale)) return false;

    if (typeof where.productionStatus === 'string') {
      if (item.productionStatus !== where.productionStatus) return false;
    } else if (where.productionStatus?.in) {
      if (!where.productionStatus.in.includes(item.productionStatus)) return false;
    }

    if (Array.isArray(where.OR) && where.OR.length > 0) {
      const orHit = where.OR.some((clause) => {
        if (clause.description?.contains) {
          return String(item.description || '')
            .toLowerCase()
            .includes(String(clause.description.contains).toLowerCase());
        }
        if (clause.customDimensions?.contains) {
          return String(item.customDimensions || '')
            .toLowerCase()
            .includes(String(clause.customDimensions.contains).toLowerCase());
        }
        if (clause.sale?.saleNumber?.contains) {
          return String(sale?.saleNumber || '')
            .toLowerCase()
            .includes(String(clause.sale.saleNumber.contains).toLowerCase());
        }
        return false;
      });
      if (!orHit) return false;
    }

    return true;
  };

  const hydrateItem = (item) => {
    const sale = salesMap.get(item.saleId) || null;
    const itemLogs = state.logs
      .filter((l) => l.saleItemId === item.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((l) => ({
        ...l,
        user: usersMap.get(l.userId) || null,
      }));
    return {
      ...item,
      product: item.product || { id: 'prod-1', name: item.description, sku: 'SKU-1', imageUrl: null, category: 'ANIME' },
      productionLogs: itemLogs,
      sale: sale
        ? {
            ...sale,
            event: sale.event || { id: sale.eventId, name: 'Feria Majadas', location: 'Zona 11' },
            seller: sale.seller || { id: sale.sellerId || 'seller-1', fullName: 'Vendedor Stand' },
            customer: sale.customer || null,
          }
        : null,
    };
  };

  prisma.saleItem.count = async ({ where } = {}) => state.items.filter((it) => matchesItemWhere(it, where)).length;

  prisma.saleItem.findMany = async ({ where, skip = 0, take = 500, orderBy } = {}) => {
    const filtered = state.items.filter((it) => matchesItemWhere(it, where));
    filtered.sort((a, b) => {
      if (Array.isArray(orderBy)) {
        const aChanged = a.statusChangedAt ? new Date(a.statusChangedAt).getTime() : 0;
        const bChanged = b.statusChangedAt ? new Date(b.statusChangedAt).getTime() : 0;
        if (bChanged !== aChanged) return bChanged - aChanged;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return filtered.slice(skip, skip + take).map(hydrateItem);
  };

  prisma.saleItem.findUnique = async ({ where } = {}) => {
    const found = state.items.find((it) => it.id === where.id);
    return found ? hydrateItem(found) : null;
  };

  prisma.saleItem.update = async ({ where, data } = {}) => {
    const idx = state.items.findIndex((it) => it.id === where.id);
    if (idx === -1) throw new Error('Item not found');
    state.items[idx] = { ...state.items[idx], ...data, updatedAt: new Date() };
    return hydrateItem(state.items[idx]);
  };

  prisma.productionLog.create = async ({ data } = {}) => {
    const entry = {
      id: `plog-${state.logs.length + 1}`,
      ...data,
      createdAt: new Date(Date.now() + state.logs.length * 1000),
    };
    state.logs.push(entry);
    return entry;
  };

  prisma.auditLog.create = async ({ data } = {}) => {
    state.auditLogs.push(data);
    return data;
  };

  prisma.$transaction = async (fn) => fn(prisma);

  const restore = () => {
    prisma.saleItem.count = originals.itemCount;
    prisma.saleItem.findMany = originals.itemFindMany;
    prisma.saleItem.findUnique = originals.itemFindUnique;
    prisma.saleItem.update = originals.itemUpdate;
    prisma.productionLog.create = originals.prodLogCreate;
    prisma.auditLog.create = originals.auditLogCreate;
    prisma.$transaction = originals.transaction;
  };

  return { state, restore };
}

describe('🏭 feat-016: Cola >300 Diseños, Tamaño Visible en Móvil y Archivo Inmutable por Operario', () => {
  describe('1. Desbloqueo de Cola Masiva (>300+ diseños) y Exclusión Estricta de Ventas Anuladas', () => {
    it('1.1. Retorna los 360 diseños completos en una sola consulta sin truncar en 50 ni 100 y excluye ventas ANULADAS', async () => {
      const sales = [];
      const items = [];

      // 207 ventas válidas generando 360 diseños distintos
      for (let s = 1; s <= 207; s += 1) {
        sales.push({
          id: `sale-${s}`,
          tenantId: 'tenant-deko',
          eventId: 'evt-feria-1',
          saleNumber: `F-${String(s).padStart(4, '0')}`,
          status: 'COMPLETADA',
          orderType: 'POS_FERIA',
          paymentStatus: 'PAGADO_TOTAL',
        });
      }
      for (let i = 1; i <= 360; i += 1) {
        const saleIdx = ((i - 1) % 207) + 1;
        items.push({
          id: `item-${i}`,
          saleId: `sale-${saleIdx}`,
          description: `Póster Colección #${i} (Mediano)`,
          productionStatus: 'PENDIENTE',
          createdAt: new Date(Date.UTC(2026, 10, 16, 14, 0, i % 60)),
        });
      }

      // 5 ventas ANULADAS con 12 diseños que JAMÁS deben contaminar producción ni métricas
      sales.push({
        id: 'sale-void-1',
        tenantId: 'tenant-deko',
        eventId: 'evt-feria-1',
        saleNumber: 'F-VOID',
        status: 'ANULADA',
        orderType: 'POS_FERIA',
        paymentStatus: 'PAGADO_TOTAL',
      });
      for (let v = 1; v <= 12; v += 1) {
        items.push({
          id: `void-item-${v}`,
          saleId: 'sale-void-1',
          description: `Póster Anulado #${v} (Grande)`,
          productionStatus: 'PENDIENTE',
        });
      }

      const harness = installProductionPrismaHarness({ initialSales: sales, initialItems: items });
      try {
        const resOp1 = await getProductionItems({
          tenantId: 'tenant-deko',
          eventId: 'evt-feria-1',
          source: 'REPOSICIONES',
          userRoles: ['OPERARIO_1'],
        });

        assert.equal(resOp1.total, 360, 'Debe contabilizar exactamente los 360 diseños activos sin los 12 anulados');
        assert.equal(resOp1.items.length, 360, 'No debe truncar en 50 ni 100: entrega los 360 diseños completos');
        assert.equal(resOp1.limit, 500, 'El límite por defecto debe ser 500 diseños por página');
        assert.equal(resOp1.totalPages, 1);
        assert.ok(
          resOp1.items.every((it) => it.sale?.status !== 'ANULADA'),
          'Ningún ítem devuelto puede pertenecer a una venta ANULADA'
        );

        const metrics = await getProductionMetrics({
          tenantId: 'tenant-deko',
          eventId: 'evt-feria-1',
          source: 'REPOSICIONES',
          userRoles: ['OPERARIO_1'],
        });
        assert.equal(metrics.pending, 360, 'Las métricas deben excluir los 12 diseños anulados');
        assert.equal(metrics.total, 360);
      } finally {
        harness.restore();
      }
    });

    it('1.2. Soporta paginación limpia hasta limit=1000 cuando una feria supera los 500 diseños', async () => {
      const sales = [{
        id: 'sale-massive',
        tenantId: 'tenant-deko',
        eventId: 'evt-feria-masiva',
        saleNumber: 'M-001',
        status: 'COMPLETADA',
        orderType: 'POS_FERIA',
        paymentStatus: 'PAGADO_TOTAL',
      }];
      const items = Array.from({ length: 620 }, (_, idx) => ({
        id: `m-item-${idx + 1}`,
        saleId: 'sale-massive',
        description: `Diseño Masivo ${idx + 1} (Grande)`,
        productionStatus: 'PENDIENTE',
      }));

      const harness = installProductionPrismaHarness({ initialSales: sales, initialItems: items });
      try {
        const page1 = await getProductionItems({
          tenantId: 'tenant-deko',
          status: 'PENDIENTE',
          page: 1,
          limit: 500,
          userRoles: ['OPERARIO_1'],
          source: 'REPOSICIONES',
        });
        assert.equal(page1.items.length, 500);
        assert.equal(page1.total, 620);
        assert.equal(page1.totalPages, 2);
        assert.equal(page1.hasNext, true);
        assert.equal(page1.hasPrev, false);

        const page2 = await getProductionItems({
          tenantId: 'tenant-deko',
          status: 'PENDIENTE',
          page: 2,
          limit: 500,
          userRoles: ['OPERARIO_1'],
          source: 'REPOSICIONES',
        });
        assert.equal(page2.items.length, 120);
        assert.equal(page2.hasNext, false);
        assert.equal(page2.hasPrev, true);

        const singleBatch = await getProductionItems({
          tenantId: 'tenant-deko',
          status: 'PENDIENTE',
          page: 1,
          limit: 1000,
          userRoles: ['SUPER_ADMIN'],
          source: 'REPOSICIONES',
        });
        assert.equal(singleBatch.items.length, 620, 'Con limit=1000 entrega los 620 diseños completos');
      } finally {
        harness.restore();
      }
    });
  });

  describe('2. Cola Activa vs Archivo Inmutable con Sello de Usuario, Fecha y Hora (Operario 1 y Operario 2)', () => {
    it('2.1. Operario 1: al marcar SEPARADO o A_PRODUCCION sale de su cola activa, entra al Archivo Inmutable con su nombre/fecha/hora y bloquea con HTTP 403 cualquier re-modificación', async () => {
      const sales = [{
        id: 'sale-10',
        tenantId: 'tenant-deko',
        eventId: 'evt-1',
        saleNumber: 'F-0010',
        status: 'COMPLETADA',
        orderType: 'POS_FERIA',
        paymentStatus: 'PAGADO_TOTAL',
      }];
      const items = [
        { id: 'it-stock', saleId: 'sale-10', description: 'Starry Night Van Gogh (Mediano)', productionStatus: 'PENDIENTE' },
        { id: 'it-print', saleId: 'sale-10', description: 'Berserk Guts Armor (Gigante)', productionStatus: 'PENDIENTE' },
        { id: 'it-stay', saleId: 'sale-10', description: 'Akira Kaneda Bike (Grande)', productionStatus: 'PENDIENTE' },
      ];
      const users = {
        'user-op1': { fullName: 'Ana Gómez (Stock)', email: 'ana@decovintage.gt' },
        'user-op2': { fullName: 'Carlos Méndez (Taller)', email: 'carlos@decovintage.gt' },
      };

      const harness = installProductionPrismaHarness({ initialSales: sales, initialItems: items, users });
      try {
        // 1. Cola inicial de Operario 1 muestra los 3 pendientes
        const initialQueue = await getProductionItems({
          tenantId: 'tenant-deko',
          userRoles: ['OPERARIO_1'],
          source: 'REPOSICIONES',
        });
        assert.equal(initialQueue.items.length, 3);

        // 2. Operario 1 separa de stock 'it-stock'
        await updateItemProductionStatus({
          id: 'it-stock',
          tenantId: 'tenant-deko',
          status: 'SEPARADO',
          userId: 'user-op1',
          userRoles: ['OPERARIO_1'],
        });

        // Desaparece de inmediato de la Cola Pendiente de Operario 1
        const afterSeparateQueue = await getProductionItems({
          tenantId: 'tenant-deko',
          status: 'PENDIENTE',
          userRoles: ['OPERARIO_1'],
          source: 'REPOSICIONES',
        });
        assert.equal(afterSeparateQueue.items.length, 2);
        assert.ok(!afterSeparateQueue.items.some((x) => x.id === 'it-stock'));

        // Operario 1 intenta revertir a PENDIENTE o cambiar a A_PRODUCCION un diseño ya SEPARADO -> 403 INMUTABLE
        await assert.rejects(
          () => updateItemProductionStatus({
            id: 'it-stock',
            tenantId: 'tenant-deko',
            status: 'PENDIENTE',
            userId: 'user-op1',
            userRoles: ['OPERARIO_1'],
          }),
          (err) => err.statusCode === 403 && /inmutable/i.test(err.message)
        );

        await assert.rejects(
          () => updateItemProductionStatus({
            id: 'it-stock',
            tenantId: 'tenant-deko',
            status: 'A_PRODUCCION',
            userId: 'user-op1',
            userRoles: ['OPERARIO_1'],
          }),
          (err) => err.statusCode === 403 && /inmutable/i.test(err.message)
        );

        // 3. Operario 1 envía 'it-print' a impresión (A_PRODUCCION)
        await updateItemProductionStatus({
          id: 'it-print',
          tenantId: 'tenant-deko',
          status: 'A_PRODUCCION',
          userId: 'user-op1',
          userRoles: ['OPERARIO_1'],
        });

        // Cola activa de Operario 1 ahora solo tiene 1 diseño ('it-stay')
        const activeOp1 = await getProductionItems({
          tenantId: 'tenant-deko',
          status: 'PENDIENTE',
          userRoles: ['OPERARIO_1'],
          source: 'REPOSICIONES',
        });
        assert.equal(activeOp1.items.length, 1);
        assert.equal(activeOp1.items[0].id, 'it-stay');

        // Archivo de Resueltos de Operario 1 tiene los 2 diseños procesados con sello de usuario
        const archiveOp1 = await getProductionItems({
          tenantId: 'tenant-deko',
          status: 'ARCHIVO_OP1',
          userRoles: ['OPERARIO_1'],
          source: 'REPOSICIONES',
        });
        assert.equal(archiveOp1.items.length, 2);
        for (const resolved of archiveOp1.items) {
          assert.ok(resolved.productionLogs.length >= 1, 'Debe incluir productionLogs');
          assert.equal(resolved.productionLogs[0].user?.fullName, 'Ana Gómez (Stock)');
          assert.ok(resolved.productionLogs[0].createdAt, 'Debe incluir timestamp exacto');
        }

        // 4. Operario 2 ve en su Cola por Imprimir únicamente 'it-print'
        const activeOp2 = await getProductionItems({
          tenantId: 'tenant-deko',
          status: 'A_PRODUCCION',
          userRoles: ['OPERARIO_2'],
          source: 'REPOSICIONES',
        });
        assert.equal(activeOp2.items.length, 1);
        assert.equal(activeOp2.items[0].id, 'it-print');

        // Operario 2 marca 'it-print' como IMPRESO
        await updateItemProductionStatus({
          id: 'it-print',
          tenantId: 'tenant-deko',
          status: 'IMPRESO',
          userId: 'user-op2',
          userRoles: ['OPERARIO_2'],
        });

        // Desaparece de inmediato de la Cola por Imprimir de Operario 2
        const activeOp2After = await getProductionItems({
          tenantId: 'tenant-deko',
          status: 'A_PRODUCCION',
          userRoles: ['OPERARIO_2'],
          source: 'REPOSICIONES',
        });
        assert.equal(activeOp2After.items.length, 0);

        // Aparece en el Archivo de Impresos de Operario 2 con AMBOS sellos cronológicos (Op1 y Op2)
        const archiveOp2 = await getProductionItems({
          tenantId: 'tenant-deko',
          status: 'IMPRESO',
          userRoles: ['OPERARIO_2'],
          source: 'REPOSICIONES',
        });
        assert.equal(archiveOp2.items.length, 1);
        assert.equal(archiveOp2.items[0].id, 'it-print');
        assert.equal(archiveOp2.items[0].productionLogs.length, 2);

        // Si Operario 2 intenta volver a mutar o revertir un ítem ya IMPRESO -> 403 INMUTABLE
        await assert.rejects(
          () => updateItemProductionStatus({
            id: 'it-print',
            tenantId: 'tenant-deko',
            status: 'IMPRESO',
            userId: 'user-op2',
            userRoles: ['OPERARIO_2'],
          }),
          (err) => err.statusCode === 403 && /inmutable/i.test(err.message)
        );
      } finally {
        harness.restore();
      }
    });
  });

  describe('3. Extracción Determinista del Tamaño en Móvil y Formateo de Auditoría Guatemala', () => {
    it('3.1. extractPosterSizeInfo extrae todas las tallas estándar, medidas personalizadas y limpia el título largo', async () => {
      const { extractPosterSizeInfo } = await loadCardPureHelpers();

      const mediano = extractPosterSizeInfo({
        description: 'Spider-Man: Across the Spider-Verse Edición Especial Miles Morales vs Spot (Mediano)',
        unitPrice: 65,
      });
      assert.equal(mediano.sizeLabel, 'Mediano');
      assert.equal(
        mediano.displayTitle,
        'Spider-Man: Across the Spider-Verse Edición Especial Miles Morales vs Spot'
      );

      const pequeno = extractPosterSizeInfo({
        description: 'Póster Naruto Shippuden Modo Sabio (Pequeño)',
        unitPrice: 35,
      });
      assert.equal(pequeno.sizeLabel, 'Pequeño');
      assert.equal(pequeno.displayTitle, 'Póster Naruto Shippuden Modo Sabio');

      const portada = extractPosterSizeInfo({
        description: 'Pink Floyd - The Dark Side of the Moon (Portada de Álbum)',
        unitPrice: 55,
      });
      assert.equal(portada.sizeLabel, 'Portada de Álbum');
      assert.equal(portada.displayTitle, 'Pink Floyd - The Dark Side of the Moon');

      const custom = extractPosterSizeInfo({
        description: 'Personalizado: Retrato Familiar (MDF_5_5MM, 40x60 cm)',
        isCustom: true,
        customDimensions: '40x60 cm',
      });
      assert.equal(custom.sizeLabel, '40x60 cm');
      assert.equal(custom.displayTitle, 'Personalizado: Retrato Familiar');

      const byPriceFallback = extractPosterSizeInfo({
        description: 'Evangelion Unit-01 Edición Histórica Sin Paréntesis',
        isCustom: false,
        unitPrice: 210,
      });
      assert.equal(byPriceFallback.sizeLabel, 'Gigante');
    });

    it('3.2. extractAuditEntries ordena cronológicamente los sellos de Operario 1 y Operario 2 con hora de Guatemala', async () => {
      const { extractAuditEntries } = await loadCardPureHelpers();

      const entries = extractAuditEntries({
        id: 'item-xyz',
        productionStatus: 'IMPRESO',
        productionLogs: [
          {
            id: 'log-2',
            previousStatus: 'A_PRODUCCION',
            newStatus: 'IMPRESO',
            createdAt: '2026-11-16T22:30:00.000Z',
            user: { fullName: 'Carlos Méndez (Taller)' },
          },
          {
            id: 'log-1',
            previousStatus: 'PENDIENTE',
            newStatus: 'A_PRODUCCION',
            createdAt: '2026-11-16T20:15:00.000Z',
            user: { fullName: 'Ana Gómez (Stock)' },
          },
        ],
      });

      assert.equal(entries.length, 2);
      assert.equal(entries[0].actionLabel, 'Enviado a Impresión');
      assert.equal(entries[0].userName, 'Ana Gómez (Stock)');
      assert.match(entries[0].formattedDateTime, /16\/11\/2026/);

      assert.equal(entries[1].actionLabel, 'Impreso en Taller');
      assert.equal(entries[1].userName, 'Carlos Méndez (Taller)');
      assert.match(entries[1].formattedDateTime, /16\/11\/2026/);
    });
  });

  describe('4. Contratos Visuales Móviles, Cero Color Naranja e Inmutabilidad UI', () => {
    it('4.1. Cero clases amber-* u orange-* en ProductionManagementView, ProductionOrderCard y ProductionFilterTabs', () => {
      const uiFiles = [
        'src/components/ProductionManagementView.jsx',
        'src/components/production/ProductionOrderCard.jsx',
        'src/components/production/ProductionFilterTabs.jsx',
      ];
      for (const rel of uiFiles) {
        const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        assert.doesNotMatch(
          content,
          /\b(?:text|bg|border|shadow)-(?:amber|orange)-\d+/,
          `${rel} no debe contener colores naranjas ni ámbar`
        );
      }
    });

    it('4.2. ProductionOrderCard destaca el tamaño sin truncamiento (shrink-0), usa line-clamp-2 en título y oculta botones en Archivo', () => {
      const cardContent = fs.readFileSync(
        path.join(ROOT, 'src/components/production/ProductionOrderCard.jsx'),
        'utf8'
      );
      assert.ok(cardContent.includes('data-testid="poster-size-badge"'), 'Debe incluir poster-size-badge');
      assert.ok(cardContent.includes('data-testid="poster-qty-badge"'), 'Debe incluir poster-qty-badge');
      assert.ok(cardContent.includes('line-clamp-2 break-words'), 'El título debe permitir 2 líneas sin truncar en 1 línea');
      assert.ok(!/<h4[^>]*\btruncate\b/.test(cardContent), 'El título <h4> no debe usar truncate de una sola línea');
      assert.ok(cardContent.includes('data-testid="immutable-audit-record"'), 'Debe mostrar el bloque de registro inmutable');
      assert.ok(
        cardContent.includes('!isArchiveMode && !isOperatorResolved'),
        'Modo archivo e ítems resueltos por operario deben ocultar 100% los botones de acción'
      );
    });

    it('4.3. useProductionQueue y usePrintSheets consultan con limit=500 y ProductionManagementView expone selector de Archivo y paginación', () => {
      const queueHook = fs.readFileSync(
        path.join(ROOT, 'src/components/production/hooks/useProductionQueue.js'),
        'utf8'
      );
      const sheetsHook = fs.readFileSync(
        path.join(ROOT, 'src/components/production/hooks/usePrintSheets.js'),
        'utf8'
      );
      const viewContent = fs.readFileSync(
        path.join(ROOT, 'src/components/ProductionManagementView.jsx'),
        'utf8'
      );

      assert.ok(queueHook.includes("params.append('limit', '500')"), 'useProductionQueue debe usar limit=500');
      assert.ok(sheetsHook.includes('limit=500'), 'usePrintSheets debe usar limit=500 para ítems candidatos');
      assert.ok(viewContent.includes('data-testid="production-tab-active"'), 'Debe existir pestaña de Cola Activa');
      assert.ok(viewContent.includes('data-testid="production-tab-archive"'), 'Debe existir pestaña de Archivo Inmutable');
      assert.ok(viewContent.includes('data-testid="production-queue-counter"'), 'Debe mostrar contador Mostrando X de Y diseños');
    });
  });
});
