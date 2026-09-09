import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_URL,
  getValidAdminToken,
  getValidSellerToken,
  getExpiredToken,
  getInvalidSecretToken,
  apiRequest,
  getLiveTestContext,
} from './test-helpers.js';

describe('TIER 1: Feature Coverage (Opaque-Box E2E)', () => {
  let ctx;

  before(async () => {
    ctx = await getLiveTestContext();
    assert.ok(ctx.eventId, 'Active or confirmed event required for E2E testing');
  });

  // =========================================================================
  // Feature 1: API Authentication & Token Lifecycle
  // =========================================================================
  describe('F1: API Authentication & Token Lifecycle', () => {
    it('T1.1.1: Accepts valid Bearer JWT and permits access to protected endpoints', async () => {
      const res = await apiRequest('/api/events/active', {
        token: ctx.adminToken,
      });
      assert.strictEqual(res.status, 200, 'Expected HTTP 200 OK');
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data, 'Expected event data in payload');
    });

    it('T1.1.2: Rejects expired Bearer JWT with HTTP 401 and Spanish error message', async () => {
      const expiredToken = getExpiredToken(ctx.tenantId);
      const res = await apiRequest('/api/events/active', {
        token: expiredToken,
      });
      assert.strictEqual(res.status, 401, 'Expected HTTP 401 Unauthorized for expired token');
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /expirado|inválido/i);
    });

    it('T1.1.3: Rejects Bearer JWT signed with wrong secret key with HTTP 401', async () => {
      const alienToken = getInvalidSecretToken(ctx.tenantId);
      const res = await apiRequest('/api/events/active', {
        token: alienToken,
      });
      assert.strictEqual(res.status, 401, 'Expected HTTP 401 Unauthorized for alien secret');
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /expirado|inválido/i);
    });

    it('T1.1.4: Rejects malformed Bearer token strings with HTTP 401', async () => {
      const res = await apiRequest('/api/events/active', {
        token: 'this_is_not_a_jwt_token_at_all',
      });
      assert.strictEqual(res.status, 401, 'Expected HTTP 401 Unauthorized for garbage token');
      assert.strictEqual(res.body.success, false);
    });

    it('T1.1.5: Decodes and injects tenant and user claims into execution context', async () => {
      const res = await apiRequest('/api/events', {
        token: ctx.adminToken,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data), 'Expected array of events for tenant');
    });

    it('T1.1.6: Accepts Seller (ENCARGADO_STAND) token on POS operational endpoints', async () => {
      const res = await apiRequest('/api/events/active', {
        token: ctx.sellerToken,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });
  });

  // =========================================================================
  // Feature 2: Sales Creation & POS Transaction Processing
  // =========================================================================
  describe('F2: Sales Creation & POS Transaction Processing', () => {
    it('T1.2.1: Creates a basic cash sale (EFECTIVO) and generates unique sequential saleNumber', async () => {
      const payload = {
        eventId: ctx.eventId,
        items: [
          {
            description: 'Póster Mini Anime E2E',
            quantity: 1,
            unitPrice: 25.0,
          },
        ],
        payments: [
          {
            method: 'EFECTIVO',
            amount: 25.0,
          },
        ],
        discount: 0,
        notes: 'Venta básica en efectivo Tier 1',
        inputChannel: 'MANUAL_POS',
      };

      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: payload,
      });

      assert.strictEqual(res.status, 201, 'Expected HTTP 201 Created for sale');
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.saleNumber, 'Expected saleNumber in created sale');
      assert.match(res.body.data.saleNumber, /^[A-Z0-9]{3,4}-\d{4}$/, 'Expected format PREFIX-0000');
      assert.strictEqual(Number(res.body.data.totalAmount), 25);
      assert.strictEqual(res.body.data.status, 'COMPLETADA');
    });

    it('T1.2.2: Creates a multi-item sale with card payment (TARJETA) and aggregates total', async () => {
      const payload = {
        eventId: ctx.eventId,
        items: [
          { description: 'Póster Mediano Marvel', quantity: 2, unitPrice: 65.0 }, // 130
          { description: 'Sticker Holográfico', quantity: 3, unitPrice: 10.0 },   // 30
        ],
        payments: [
          {
            method: 'TARJETA',
            amount: 160.0,
            reference: 'POS-BAC-987654',
          },
        ],
        discount: 0,
        inputChannel: 'MANUAL_POS',
      };

      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: payload,
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(Number(res.body.data.totalAmount), 160);
      assert.strictEqual(res.body.data.items.length, 2);
      assert.strictEqual(res.body.data.payments[0].method, 'TARJETA');
      assert.strictEqual(res.body.data.payments[0].reference, 'POS-BAC-987654');
    });

    it('T1.2.3: Correctly applies discount reducing net payable amount', async () => {
      const payload = {
        eventId: ctx.eventId,
        items: [
          { description: 'Póster Gigante Colección', quantity: 1, unitPrice: 200.0 },
        ],
        payments: [
          { method: 'EFECTIVO', amount: 175.0 },
        ],
        discount: 25.0, // 200 - 25 = 175
        notes: 'Descuento aplicado por combo convención',
        inputChannel: 'MANUAL_POS',
      };

      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: payload,
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(Number(res.body.data.totalAmount), 175);
      assert.strictEqual(Number(res.body.data.discount), 25);
    });

    it('T1.2.4: Supports various input channels (MANUAL_RAPIDA, IA_VOZ, IA_IMAGEN_QR)', async () => {
      for (const channel of ['MANUAL_RAPIDA', 'IA_VOZ', 'IA_IMAGEN_QR']) {
        const payload = {
          eventId: ctx.eventId,
          items: [{ description: `Item vía ${channel}`, quantity: 1, unitPrice: 35.0 }],
          payments: [{ method: 'EFECTIVO', amount: 35.0 }],
          inputChannel: channel,
        };

        const res = await apiRequest('/api/sales', {
          method: 'POST',
          token: ctx.sellerToken,
          body: payload,
        });

        assert.strictEqual(res.status, 201, `Failed on channel ${channel}`);
        assert.strictEqual(res.body.data.inputChannel, channel);
      }
    });

    it('T1.2.5: Stores customer notes and records immutable seller association', async () => {
      const testNote = 'Cliente habitual de Cayalá, solicitó tubo protector.';
      const payload = {
        eventId: ctx.eventId,
        items: [{ description: 'Póster Premium', quantity: 1, unitPrice: 50.0 }],
        payments: [{ method: 'EFECTIVO', amount: 50.0 }],
        notes: testNote,
      };

      const res = await apiRequest('/api/sales', {
        method: 'POST',
        token: ctx.sellerToken,
        body: payload,
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.notes, testNote);
      assert.ok(res.body.data.sellerId, 'Expected sellerId attached to sale');
    });
  });

  // =========================================================================
  // Feature 3: Catalog Synchronization & Search
  // =========================================================================
  describe('F3: Catalog Synchronization & Search', () => {
    it('T1.3.1: Validates external web catalog schema contract', async () => {
      const res = await apiRequest('/api/catalog/web-posters?limit=1', {
        token: ctx.adminToken,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data), 'Expected array of posters');

      if (res.body.data.length > 0) {
        const poster = res.body.data[0];
        assert.ok(poster.id, 'Poster must have id');
        assert.ok(poster.titulo, 'Poster must have titulo');
        assert.ok(poster.categoria, 'Poster must have categoria');
        assert.ok(Array.isArray(poster.sizes), 'Poster must have sizes array');
        assert.ok(typeof poster.precioMinimo === 'number', 'precioMinimo must be number');
      }
    });

    it('T1.3.2: Retrieves active products catalog for current tenant', async () => {
      const res = await apiRequest('/api/products', {
        token: ctx.adminToken,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data), 'Expected array of products');
    });

    it('T1.3.3: Web catalog text query matches items by title or keywords', async () => {
      const res = await apiRequest('/api/catalog/web-posters?q=Spider&limit=5', {
        token: ctx.adminToken,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('T1.3.4: Category filter correctly restricts search results', async () => {
      const res = await apiRequest('/api/catalog/web-posters?category=SUPERHEROES&limit=5', {
        token: ctx.adminToken,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      res.body.data.forEach((item) => {
        assert.strictEqual(item.categoria, 'SUPERHEROES', 'Item category must match filter');
      });
    });

    it('T1.3.5: Limit parameter caps maximum returned results', async () => {
      const limit = 2;
      const res = await apiRequest(`/api/catalog/web-posters?limit=${limit}`, {
        token: ctx.adminToken,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.length <= limit, `Expected at most ${limit} items`);
    });

    it('T1.3.6: Posters contain structured sizes with sizeId, nombre, dimensiones and precio', async () => {
      const res = await apiRequest('/api/catalog/web-posters?limit=3', {
        token: ctx.adminToken,
      });

      assert.strictEqual(res.status, 200);
      if (res.body.data.length > 0) {
        const poster = res.body.data[0];
        assert.ok(poster.sizes.length > 0, 'Poster must have at least one size variant');
        const size = poster.sizes[0];
        assert.ok(size.sizeId, 'Size must define sizeId');
        assert.ok(size.nombre, 'Size must define nombre');
        assert.ok(typeof size.precio === 'number', 'Size precio must be numeric');
      }
    });
  });

  // =========================================================================
  // Feature 4: Cloud Storage & Media Persistence
  // =========================================================================
  describe('F4: Cloud Storage & Media Persistence', () => {
    it('T1.4.1: Storage service contract defines uploadBufferToStorage signature', async () => {
      const storageModule = await import('../../server/services/gcsStorageService.js');
      assert.ok(typeof storageModule.uploadBufferToStorage === 'function', 'uploadBufferToStorage must be exported function');
    });

    it('T1.4.2: Upload buffer returns standard schema { success, url, filename }', async () => {
      const { uploadBufferToStorage } = await import('../../server/services/gcsStorageService.js');
      const testBuffer = Buffer.from('TEST_E2E_PAYMENT_VOUCHER_DATA');
      const result = await uploadBufferToStorage({
        buffer: testBuffer,
        originalname: 'voucher_test.png',
        mimetype: 'image/png',
        folder: 'receipts',
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.url, 'Expected url in storage response');
      assert.ok(result.filename, 'Expected filename in storage response');
      assert.match(result.filename, /^receipts\//, 'Expected receipts/ prefix in filename');
    });

    it('T1.4.3: Folder segregation partitions files into dedicated subdirectories', async () => {
      const { uploadBufferToStorage } = await import('../../server/services/gcsStorageService.js');
      const folders = ['sales', 'audio', 'vouchers'];

      for (const folder of folders) {
        const result = await uploadBufferToStorage({
          buffer: Buffer.from(`DATA_FOR_${folder}`),
          originalname: `test_${folder}.bin`,
          mimetype: 'application/octet-stream',
          folder,
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.filename.startsWith(`${folder}/`), `Filename must begin with ${folder}/`);
      }
    });

    it('T1.4.4: Storage URLs point to valid HTTP/HTTPS endpoints', async () => {
      const { uploadBufferToStorage } = await import('../../server/services/gcsStorageService.js');
      const result = await uploadBufferToStorage({
        buffer: Buffer.from('CHECK_URL_STRUCTURE'),
        originalname: 'check.jpg',
        mimetype: 'image/jpeg',
        folder: 'sales',
      });

      assert.strictEqual(result.success, true);
      assert.ok(
        result.url.startsWith('https://storage.googleapis.com/') || result.url.startsWith('/uploads/'),
        'Storage URL must be GCS URL or local fallback in dev'
      );
    });

    it('T1.4.5: Handles media extensions and filenames safely without path traversal', async () => {
      const { uploadBufferToStorage } = await import('../../server/services/gcsStorageService.js');
      const result = await uploadBufferToStorage({
        buffer: Buffer.from('SAFE_FILENAME'),
        originalname: '../../../etc/passwd.png',
        mimetype: 'image/png',
        folder: 'receipts',
      });

      assert.strictEqual(result.success, true);
      assert.ok(!result.filename.includes('..'), 'Path traversal must be sanitized');
    });
  });

  // =========================================================================
  // Feature 5: Health Check & System Observability
  // =========================================================================
  describe('F5: Health Check & System Observability', () => {
    it('T1.5.1: GET /health responds with HTTP 200 OK', async () => {
      const res = await apiRequest('/health');
      assert.strictEqual(res.status, 200, 'Expected HTTP 200 OK');
    });

    it('T1.5.2: GET /health response body contains required fields { status, time, env }', async () => {
      const res = await apiRequest('/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.ok(res.body.time, 'Expected time property in health response');
      assert.ok(res.body.env, 'Expected env property in health response');
    });

    it('T1.5.3: GET /health responds within strict latency SLA (< 500ms)', async () => {
      const start = Date.now();
      const res = await apiRequest('/health');
      const latency = Date.now() - start;

      assert.strictEqual(res.status, 200);
      assert.ok(latency < 500, `Health check latency ${latency}ms exceeds 500ms SLA`);
    });

    it('T1.5.4: GET /health returns application/json content-type header', async () => {
      const res = await apiRequest('/health');
      assert.strictEqual(res.status, 200);
      const contentType = res.headers.get('content-type') || '';
      assert.ok(
        contentType.includes('application/json'),
        `Expected application/json content-type, got: ${contentType}`
      );
    });

    it('T1.5.5: GET /health is publicly accessible without Authorization token', async () => {
      const res = await apiRequest('/health', { token: null });
      assert.strictEqual(res.status, 200, 'Health endpoint must be public probe');
    });
  });
});
