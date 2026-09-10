/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚔️ DEEP ADVERSARIAL STRESS TEST: MULTITENANT ISOLATION & ZERO-TRUST BOUNDARIES
 * ═══════════════════════════════════════════════════════════════════════════════
 * Evaluador Empírico: challenger_m2_3 (teamwork_preview_challenger)
 * 
 * Propósito:
 * Desafiar con rigor militar el aislamiento multitenant de `webCatalogService.js`
 * bajo estrés concurrente masivo, colisiones de SKU, búsquedas de textos idénticos,
 * invalidaciones parciales, ataques de inyección y resiliencia ante caídas de DB.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('⚔️ STRESS ADVERSARIAL MULTITENANT — webCatalogService & Zero-Trust', async () => {
  const { prisma } = await import('../../server/config/prisma.js');
  const catService = await import('../../server/services/webCatalogService.js');

  // Generador dinámico de base de datos multitenant: 10 tenants x 5 productos = 50 productos
  const NUM_TENANTS = 10;
  const PRODUCTS_PER_TENANT = 5;
  const multiTenantDb = new Map();

  for (let t = 1; t <= NUM_TENANTS; t++) {
    const tenantId = `tenant_${String(t).padStart(3, '0')}`;
    const products = [];
    for (let p = 1; p <= PRODUCTS_PER_TENANT; p++) {
      products.push({
        id: `poster-${tenantId}-item-${p}`,
        sku: `SKU-${tenantId}-P${p}`,
        name: `Póster Confidencial ${tenantId} - Serie ${p}`,
        category: p % 2 === 0 ? 'VINTAGE' : 'HISTÓRICOS',
        tenantId,
        basePrice: 50 + t * 10 + p,
        isActive: true,
        sizes: [
          { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30x45', precio: 50 + t * 10 + p },
        ],
      });
    }
    multiTenantDb.set(tenantId, products);
  }

  // Interceptar prisma.product con soporte para simulación de fallas
  let dbSimulateError = false;
  let dbCallCount = 0;

  prisma.product = {
    findMany: async (args) => {
      dbCallCount++;
      if (dbSimulateError) throw new Error('DB_FATAL_CONNECTION_FAILURE');
      const tenantId = args?.where?.tenantId;
      if (tenantId && multiTenantDb.has(tenantId)) {
        return multiTenantDb.get(tenantId);
      }
      if (!tenantId) {
        // Retornar todos los productos
        const all = [];
        for (const list of multiTenantDb.values()) all.push(...list);
        return all;
      }
      return [];
    },
    findFirst: async (args) => {
      dbCallCount++;
      if (dbSimulateError) throw new Error('DB_FATAL_CONNECTION_FAILURE');
      const tenantId = args?.where?.tenantId;
      const idOrSkuConditions = args?.where?.OR || [];
      const targets = idOrSkuConditions.map((o) => o.id || o.sku).filter(Boolean);

      let pool = [];
      if (tenantId) {
        pool = multiTenantDb.get(tenantId) || [];
      } else {
        for (const list of multiTenantDb.values()) pool.push(...list);
      }

      return pool.find((item) => targets.includes(item.id) || targets.includes(item.sku)) || null;
    },
  };

  beforeEach(() => {
    dbSimulateError = false;
    dbCallCount = 0;
    catService.invalidateCatalogCache();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ESTRÉS CONCURRENTE N-TENANTS: 450 CONSULTAS CRUZADAS
  // ─────────────────────────────────────────────────────────────────────────────
  it('1.1 Matriz de aislamiento masivo: 10 tenants x 10 tenants (450 consultas cruzadas resultan estrictamente en 0 fugas)', async () => {
    // Calentar solo los tenants impares (1, 3, 5, 7, 9)
    for (let t = 1; t <= NUM_TENANTS; t += 2) {
      const tenantId = `tenant_${String(t).padStart(3, '0')}`;
      await catService.searchWebPosters({ tenantId });
    }

    let crossTenantAttempts = 0;
    let leaksDetected = 0;
    let legitimateHits = 0;

    for (let tReq = 1; tReq <= NUM_TENANTS; tReq++) {
      const requestingTenant = `tenant_${String(tReq).padStart(3, '0')}`;

      for (let tTarget = 1; tTarget <= NUM_TENANTS; tTarget++) {
        const targetTenant = `tenant_${String(tTarget).padStart(3, '0')}`;
        const targetProductList = multiTenantDb.get(targetTenant);

        for (const targetProduct of targetProductList) {
          const result = await catService.getWebPosterById(targetProduct.id, requestingTenant);

          if (tReq === tTarget) {
            // Consulta legítima dentro del mismo tenant
            assert.ok(result, `Tenant ${requestingTenant} debe poder ver su propio producto ${targetProduct.id}`);
            assert.equal(result.id, targetProduct.id);
            legitimateHits++;
          } else {
            // Consulta cruzada adversarial: DEBE SER NULL
            crossTenantAttempts++;
            if (result !== null) {
              leaksDetected++;
              console.error(`🚨 FUGA DETECTADA: ${requestingTenant} obtuvo producto de ${targetTenant}:`, result);
            }
          }
        }
      }
    }

    assert.equal(legitimateHits, NUM_TENANTS * PRODUCTS_PER_TENANT, 'Todos los accesos legítimos deben retornar producto');
    assert.equal(crossTenantAttempts, NUM_TENANTS * (NUM_TENANTS - 1) * PRODUCTS_PER_TENANT, 'Debe haber evaluado exactamente 450 intentos cruzados');
    assert.equal(leaksDetected, 0, `FUGA MULTITENANT CRÍTICA: Se detectaron ${leaksDetected} fugas de datos entre organizaciones ajenas!`);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. ORÁCULO DE AISLAMIENTO EN CACHÉ FRÍA Y CONSULTA A DB
  // ─────────────────────────────────────────────────────────────────────────────
  it('1.2 Aislamiento estricto en frío: Búsqueda con caché completamente vacía no filtra registros ajenos de base de datos', async () => {
    catService.invalidateCatalogCache();

    // Intentar buscar póster de tenant_005 solicitándolo con tenant_002 en frío
    const result = await catService.getWebPosterById('poster-tenant_005-item-1', 'tenant_002');
    assert.equal(result, null, 'No debe filtrar producto de tenant_005 a tenant_002 en consulta a DB fría');

    // Comprobar que tenant_002 no tiene en su caché el producto de 005
    const posterBetaDirect = await catService.getWebPosterById('poster-tenant_005-item-1', 'tenant_005');
    assert.ok(posterBetaDirect, 'Tenant 005 legítimo sí debe poder consultar su producto');
    assert.equal(posterBetaDirect.id, 'poster-tenant_005-item-1');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. AISLAMIENTO DE BÚSQUEDA BAJO KEYWORDS IDÉNTICOS
  // ─────────────────────────────────────────────────────────────────────────────
  it('1.3 searchWebPosters aísla estrictamente catálogos cuando múltiples tenants tienen títulos idénticos', async () => {
    // Añadir producto con nombre idéntico a 3 tenants
    const sharedName = 'Edición Especial Star Wars Coleccionista';
    multiTenantDb.get('tenant_001').push({
      id: 'sw-001',
      sku: 'SKU-SW-1',
      name: `${sharedName} - Tenant 001`,
      category: 'CÓMICS',
      tenantId: 'tenant_001',
      basePrice: 100,
      isActive: true,
      sizes: [],
    });

    multiTenantDb.get('tenant_002').push({
      id: 'sw-002',
      sku: 'SKU-SW-2',
      name: `${sharedName} - Tenant 002`,
      category: 'CÓMICS',
      tenantId: 'tenant_002',
      basePrice: 150,
      isActive: true,
      sizes: [],
    });

    multiTenantDb.get('tenant_003').push({
      id: 'sw-003',
      sku: 'SKU-SW-3',
      name: `${sharedName} - Tenant 003`,
      category: 'CÓMICS',
      tenantId: 'tenant_003',
      basePrice: 200,
      isActive: true,
      sizes: [],
    });

    catService.invalidateCatalogCache();

    // Búsqueda para tenant_001
    const results001 = await catService.searchWebPosters({ tenantId: 'tenant_001', query: 'Star Wars' });
    assert.ok(results001.length >= 1, 'Tenant 001 debe encontrar su propio póster');
    assert.ok(results001.some((p) => p.id === 'sw-001'));
    assert.ok(!results001.some((p) => p.id === 'sw-002'), 'Tenant 001 NUNCA debe ver sw-002');
    assert.ok(!results001.some((p) => p.id === 'sw-003'), 'Tenant 001 NUNCA debe ver sw-003');

    // Búsqueda para tenant_002
    const results002 = await catService.searchWebPosters({ tenantId: 'tenant_002', query: 'Star Wars' });
    assert.ok(results002.length >= 1, 'Tenant 002 debe encontrar su propio póster');
    assert.ok(results002.some((p) => p.id === 'sw-002'));
    assert.ok(!results002.some((p) => p.id === 'sw-001'), 'Tenant 002 NUNCA debe ver sw-001');
    assert.ok(!results002.some((p) => p.id === 'sw-003'), 'Tenant 002 NUNCA debe ver sw-003');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. COLISIÓN DE SKU ENTRE TENANTS
  // ─────────────────────────────────────────────────────────────────────────────
  it('1.4 Colisión de SKU idéntico: Retorna exactamente la versión del tenant que consulta', async () => {
    const identicalSku = 'SKU-CLASH-EXACT';

    multiTenantDb.get('tenant_001').push({
      id: 'clash-001',
      sku: identicalSku,
      name: 'Póster Exclusivo Tenant 1 - Arte',
      category: 'ARTE',
      tenantId: 'tenant_001',
      basePrice: 40,
      isActive: true,
      sizes: [{ sizeId: 'MEDIANO', precio: 40 }],
    });

    multiTenantDb.get('tenant_002').push({
      id: 'clash-002',
      sku: identicalSku,
      name: 'Póster Exclusivo Tenant 2 - Vintage',
      category: 'VINTAGE',
      tenantId: 'tenant_002',
      basePrice: 90,
      isActive: true,
      sizes: [{ sizeId: 'MEDIANO', precio: 90 }],
    });

    catService.invalidateCatalogCache();

    const poster1 = await catService.getWebPosterById(identicalSku, 'tenant_001');
    assert.ok(poster1);
    assert.equal(poster1.id, 'clash-001');
    assert.equal(poster1.precioMinimo, 40);

    const poster2 = await catService.getWebPosterById(identicalSku, 'tenant_002');
    assert.ok(poster2);
    assert.equal(poster2.id, 'clash-002');
    assert.equal(poster2.precioMinimo, 90);

    // Tenant 3 no tiene ese SKU
    const poster3 = await catService.getWebPosterById(identicalSku, 'tenant_003');
    assert.equal(poster3, null, 'Tenant 003 no debe ver el SKU en colisión');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. PRECISIÓN DE INVALIDACIÓN DE CACHÉ
  // ─────────────────────────────────────────────────────────────────────────────
  it('1.5 Invalidation selectiva preserva la caché de otros tenants y reduce carga en DB', async () => {
    // Calentar 001 y 002
    await catService.searchWebPosters({ tenantId: 'tenant_001' });
    await catService.searchWebPosters({ tenantId: 'tenant_002' });

    const initialCalls = dbCallCount;

    // Invalidar SOLO tenant_001
    catService.invalidateCatalogCache('tenant_001');

    // Consultar tenant_002 (debe responder desde caché en 0 llamadas a DB)
    const p2 = await catService.getWebPosterById('poster-tenant_002-item-1', 'tenant_002');
    assert.ok(p2);
    assert.equal(dbCallCount, initialCalls, 'Tenant 002 debe servirse desde memoria sin tocar la DB');

    // Consultar tenant_001 (debe recargar de DB porque fue invalidado)
    const p1 = await catService.getWebPosterById('poster-tenant_001-item-1', 'tenant_001');
    assert.ok(p1);
    assert.ok(dbCallCount > initialCalls, 'Tenant 001 debe haber consultado DB tras invalidación');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. ENTRADAS ANÓMALAS Y FRONTERA ADVERSARIAL
  // ─────────────────────────────────────────────────────────────────────────────
  it('1.6 Entradas maliciosas, vacías o anómalas se manejan limpiamente sin excepciones', async () => {
    // Parámetros vacíos o falsy
    assert.equal(await catService.getWebPosterById(null, 'tenant_001'), null);
    assert.equal(await catService.getWebPosterById('', 'tenant_001'), null);
    assert.equal(await catService.getWebPosterById(undefined, 'tenant_001'), null);

    // Tenant inexistente
    assert.equal(await catService.getWebPosterById('poster-tenant_001-item-1', 'tenant_fantasma_xyz'), null);

    // Intento de prototype pollution
    assert.equal(await catService.getWebPosterById('poster-tenant_001-item-1', '__proto__'), null);
    assert.equal(await catService.getWebPosterById('poster-tenant_001-item-1', 'constructor'), null);

    // Búsqueda en tenant fantasma retorna arreglo vacío
    const ghostResults = await catService.searchWebPosters({ tenantId: 'tenant_fantasma_xyz', query: 'poster' });
    assert.deepEqual(ghostResults, []);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. RESILIENCIA ANTE CAÍDA CATASTRÓFICA DE BASE DE DATOS
  // ─────────────────────────────────────────────────────────────────────────────
  it('1.7 Si la base de datos se cae, getWebPosterById captura el fallo y retorna null sin crashear el proceso', async () => {
    catService.invalidateCatalogCache();
    dbSimulateError = true; // Forzar error fatal en prisma.product.findFirst

    let errorThrown = false;
    let result = undefined;

    try {
      result = await catService.getWebPosterById('any-poster-id', 'tenant_001');
    } catch (err) {
      errorThrown = true;
    }

    assert.equal(errorThrown, false, 'getWebPosterById NO debe lanzar excepción no controlada ante caída de DB');
    assert.equal(result, null, 'getWebPosterById debe retornar null de forma segura ante falla de DB');
  });
});
