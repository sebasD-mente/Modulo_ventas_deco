import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secure_web_orders_hardening_feat024_secret_2026';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS || 'superadmin@dekolabs.org';

import {
  deleteWebOrder,
  extractStructuredCustomerFromNotes,
  ingestWebOrderWebhook,
  listWebOrders,
  syncWebOrdersFromWeb,
} from '../../server/services/sales/webOrderInboxService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

async function loadModuleHeaderExports(relPath, splitMarker) {
  const fullPath = path.join(ROOT, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const splitIdx = source.indexOf(splitMarker);
  assert.ok(splitIdx > 0, `${relPath} debe contener "${splitMarker}"`);
  const headerOnly = source.slice(0, splitIdx).replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\r?\n/gm, '');
  const dataUrl = `data:text/javascript;base64,${Buffer.from(headerOnly, 'utf8').toString('base64')}`;
  return import(dataUrl);
}

const { buildWebOrderCustomerDraft } = await loadModuleHeaderExports(
  'src/components/manual-sale/hooks/useWebOrderImport.js',
  'export function useWebOrderImport'
);

function createChronoMockPrisma(seedProducts = []) {
  const rows = new Map();
  const auditLogs = [];
  let seq = 0;
  let tick = 1000;

  return {
    rows,
    auditLogs,
    product: {
      findMany: async ({ where }) => {
        const skus = where?.sku?.in || [];
        return seedProducts.filter((p) => p.tenantId === where.tenantId && skus.includes(p.sku));
      },
    },
    webOrderInbox: {
      findUnique: async ({ where }) => {
        const comp = where?.tenantId_orderNumber;
        if (comp) {
          for (const r of rows.values()) {
            if (r.tenantId === comp.tenantId && r.orderNumber === comp.orderNumber) return r;
          }
        }
        return where?.id ? (rows.get(where.id) || null) : null;
      },
      findFirst: async ({ where }) => {
        for (const r of rows.values()) {
          if (where.id && r.id !== where.id) continue;
          if (where.tenantId && r.tenantId !== where.tenantId) continue;
          return r;
        }
        return null;
      },
      create: async ({ data }) => {
        tick += 10;
        const rec = { id: `woi-${++seq}`, createdAt: new Date(tick), updatedAt: new Date(tick), ...data };
        rows.set(rec.id, rec);
        return rec;
      },
      update: async ({ where, data }) => {
        const prev = rows.get(where.id);
        const next = { ...prev, ...data, updatedAt: new Date(++tick) };
        rows.set(next.id, next);
        return next;
      },
      delete: async ({ where }) => {
        const prev = rows.get(where.id);
        rows.delete(where.id);
        return prev;
      },
      findMany: async ({ where, skip = 0, take = 50, orderBy }) => {
        const list = [...rows.values()].filter((r) => {
          if (where.tenantId && r.tenantId !== where.tenantId) return false;
          if (where.status && r.status !== where.status) return false;
          return true;
        });
        const rules = Array.isArray(orderBy) ? orderBy : (orderBy ? [orderBy] : []);
        list.sort((a, b) => {
          for (const rule of rules) {
            const [field, dir] = Object.entries(rule)[0];
            const av = a[field] ? new Date(a[field]).getTime() : 0;
            const bv = b[field] ? new Date(b[field]).getTime() : 0;
            if (av !== bv) return dir === 'desc' ? bv - av : av - bv;
          }
          return 0;
        });
        return list.slice(skip, skip + take);
      },
      count: async ({ where }) => {
        let c = 0;
        for (const r of rows.values()) {
          if (where.tenantId && r.tenantId !== where.tenantId) continue;
          if (where.status && r.status !== where.status) continue;
          c++;
        }
        return c;
      },
    },
    auditLog: {
      create: async ({ data }) => {
        auditLogs.push(data);
        return data;
      },
    },
  };
}

describe('feat-024: Endurecimiento Post-Integración del Pipeline S2S de Pedidos Web', () => {
  it('1. Elimina el bucle infinito de refresco de 200ms en WebOrdersInboxView.jsx y App.jsx', () => {
    const inboxSrc = fs.readFileSync(path.join(ROOT, 'src/components/WebOrdersInboxView.jsx'), 'utf8');
    const appSrc = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8');

    assert.ok(inboxSrc.includes('const onCountsChangedRef = useRef(onCountsChanged);'));
    assert.ok(
      inboxSrc.includes('}, [authFetch, statusFilter, searchQuery]);'),
      'loadOrders no debe depender de la función inline onCountsChanged para evitar re-ejecución infinita'
    );
    assert.ok(
      appSrc.includes('if (meta?.mutated) setWebOrdersRefreshKey((prev) => prev + 1);'),
      'App.jsx solo debe incrementar webOrdersRefreshKey cuando ocurre una mutación real'
    );
  });

  it('2. Ordena cronológicamente del pedido web más reciente al más antiguo tras syncWebOrdersFromWeb', async () => {
    const mockPrisma = createChronoMockPrisma();
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [
          { orderNumber: 'CP-872579', createdAt: '2026-11-18T18:07:12.458Z', totalPrice: 98.28, items: [{ title: 'Reciente', sizeMode: 'custom', customWidth: 30.2, customHeight: 45.2, material: 'VINILO_SOLO', unitPrice: 32.76, quantity: 3 }] },
          { orderNumber: 'CP-760375', createdAt: '2026-11-13T14:20:37.609Z', totalPrice: 55, items: [{ title: 'Intermedio', sizeId: 'PORTADA_ALBUM', unitPrice: 55, quantity: 1 }] },
          { orderNumber: 'CP-357274', createdAt: '2026-10-07T01:36:13.573Z', totalPrice: 125, items: [{ title: 'Antiguo', sizeId: 'GRANDE', unitPrice: 125, quantity: 1 }] },
        ],
      }),
    });

    const syncRes = await syncWebOrdersFromWeb({
      tenantId: 'tenant-1',
      fetchImpl: mockFetch,
      prismaClient: mockPrisma,
      envOverride: { WEB_ORDERS_WEBHOOK_SECRET: 'shared-s2s-secret' },
    });
    assert.equal(syncRes.createdCount, 3);

    const listed = await listWebOrders({ tenantId: 'tenant-1', status: 'PENDIENTE', prismaClient: mockPrisma });
    assert.deepEqual(
      listed.orders.map((o) => o.orderNumber),
      ['CP-872579', 'CP-760375', 'CP-357274'],
      'El pedido más reciente (#CP-872579) debe aparecer siempre en la posición #1'
    );
  });

  it('3. Resuelve candidatos multi-SKU (WEB-${posterId} vs WEB-${legacyId}) y extrae cliente estructurado desde customerNotes', async () => {
    const mockPrisma = createChronoMockPrisma([
      {
        id: '7da2b897-157b-49b7-ba55-afe7c25a548d',
        tenantId: 'tenant-1',
        sku: 'WEB-98358166-634d-4b6a-aa6b-2439fccba52a',
        name: 'Bulldog Francés - Héroe de Acción',
        imageUrl: 'https://storage.googleapis.com/decovintage-master-media/posters/full/bulldog.webp',
      },
    ]);

    const res = await ingestWebOrderWebhook({
      tenantId: 'tenant-1',
      prismaClient: mockPrisma,
      payload: {
        orderNumber: 'CP-501999',
        orderSource: 'WEB_CART',
        customerName: 'Cliente Web',
        customerPhone: '39861332',
        customerNotes: 'Cliente: Mishell Sandoval | Entrega: Castillo Lara zona 7 14 calle 9na avenida (Guatemala)',
        totalPrice: 125,
        items: [
          {
            isCustom: false,
            posterId: '98358166-634d-4b6a-aa6b-2439fccba52a',
            legacyId: 'obra-mtkyegy7-4031',
            sku: 'WEB-obra-mtkyegy7-4031',
            title: 'Bulldog Francés - Héroe de Acción',
            sizeMode: 'standard',
            sizeId: 'GRANDE',
            material: 'MDF_5_5MM',
            quantity: 1,
            unitPrice: 125,
          },
        ],
      },
    });

    assert.equal(res.record.customerName, 'Mishell Sandoval');
    assert.equal(res.record.customerAddress, 'Castillo Lara zona 7 14 calle 9na avenida');
    assert.equal(res.record.customerDepartment, 'Guatemala');
    assert.equal(res.record.items[0].productId, '7da2b897-157b-49b7-ba55-afe7c25a548d');
    assert.equal(res.record.items[0].sku, 'WEB-98358166-634d-4b6a-aa6b-2439fccba52a');

    const draft = buildWebOrderCustomerDraft({
      customerName: 'Cliente Web',
      customerPhone: '59869507',
      customerNotes: 'Cliente: Mariano Aldana | Entrega: 21 Avenida 2-35 Colonia las Victorias Zona 1 (Guatemala)',
    }, ['Guatemala', 'Sacatepéquez']);
    assert.equal(draft.fullName, 'Mariano Aldana');
    assert.equal(draft.deliveryAddress, '21 Avenida 2-35 Colonia las Victorias Zona 1');
    assert.equal(draft.department, 'Guatemala');

    const generic = extractStructuredCustomerFromNotes('Cliente: Cliente Web | Entrega: Por coordinar (Sacatepéquez)');
    assert.equal(generic.fullName, null);
    assert.equal(generic.address, null);
    assert.equal(generic.department, 'Sacatepéquez');
  });

  it('4. Permite eliminar definitivamente pedidos descartados/de prueba y bloquea con HTTP 409 órdenes ya IMPORTADO', async () => {
    const mockPrisma = createChronoMockPrisma();
    const createdTest = await ingestWebOrderWebhook({
      tenantId: 'tenant-1',
      prismaClient: mockPrisma,
      payload: {
        orderNumber: 'CP-TEST99',
        status: 'DESCARTADO',
        customerName: 'Prueba Pipeline',
        items: [{ title: 'Test', sizeId: 'MINI', unitPrice: 25, quantity: 1 }],
      },
    });

    const deleted = await deleteWebOrder({
      tenantId: 'tenant-1',
      id: createdTest.record.id,
      userId: 'admin-1',
      prismaClient: mockPrisma,
    });
    assert.equal(deleted.orderNumber, 'CP-TEST99');
    assert.equal(mockPrisma.rows.has(createdTest.record.id), false);
    assert.equal(mockPrisma.auditLogs.at(-1)?.action, 'PEDIDO_WEB_ELIMINADO');

    const importedRec = await ingestWebOrderWebhook({
      tenantId: 'tenant-1',
      prismaClient: mockPrisma,
      payload: {
        orderNumber: 'CP-IMP100',
        status: 'IMPORTADO',
        customerName: 'Real',
        items: [{ title: 'Real', sizeId: 'MEDIANO', unitPrice: 65, quantity: 1 }],
      },
    });

    await assert.rejects(
      () => deleteWebOrder({ tenantId: 'tenant-1', id: importedRec.record.id, prismaClient: mockPrisma }),
      (err) => err.statusCode === 409
    );
  });
});
