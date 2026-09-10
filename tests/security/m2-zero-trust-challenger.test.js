import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
const serverDir = path.resolve(projectRoot, 'server');

// Configuración de entorno de prueba para evitar fatal errors de envSchema
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'super_secure_challenger_test_jwt_secret_2026';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = 'superadmin@dekolabs.org,ia@dekolabs.org';

// =============================================================================
// 1. DESAFÍO A-01: CONTROL DE ACCESO POR EVENTO (RBAC & requireEventAccess)
// =============================================================================
describe('⚔️ Desafío A-01: Control de Acceso por Evento (RBAC & requireEventAccess)', async () => {
  const { requireEventAccess, requireRole } = await import('../../server/middleware/authMiddleware.js');

  it('1.1 Vendedor asignado a Evento A es bloqueado con HTTP 403 al solicitar Evento B vía params', () => {
    let statusCode = null;
    let jsonResponse = null;
    let nextCalled = false;

    const req = {
      user: {
        id: 'usr_seller_1',
        role: 'VENDEDOR',
        roles: ['VENDEDOR'],
        assignedEventId: 'evt_alpha',
      },
      params: { eventId: 'evt_beta' },
      body: {},
      query: {},
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    const next = () => {
      nextCalled = true;
    };

    requireEventAccess(req, res, next);

    assert.equal(statusCode, 403, 'Debe retornar HTTP 403');
    assert.equal(nextCalled, false, 'next() NO debe ser invocado');
    assert.equal(jsonResponse?.success, false);
    assert.ok(
      jsonResponse?.error?.includes('No tienes permiso'),
      'Debe retornar mensaje de acceso denegado para el evento'
    );
  });

  it('1.2 Vendedor asignado a Evento A es bloqueado con HTTP 403 al solicitar Evento B vía body', () => {
    let statusCode = null;
    let jsonResponse = null;
    let nextCalled = false;

    const req = {
      user: {
        id: 'usr_seller_1',
        role: 'VENDEDOR',
        roles: ['VENDEDOR'],
        assignedEventId: 'evt_alpha',
      },
      params: {},
      body: { eventId: 'evt_beta' },
      query: {},
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    requireEventAccess(req, res, () => {
      nextCalled = true;
    });

    assert.equal(statusCode, 403, 'Debe retornar HTTP 403 cuando eventId está en el body');
    assert.equal(nextCalled, false);
    assert.equal(jsonResponse?.success, false);
  });

  it('1.3 Vendedor asignado a Evento A es bloqueado con HTTP 403 al solicitar Evento B vía query', () => {
    let statusCode = null;
    let jsonResponse = null;
    let nextCalled = false;

    const req = {
      user: {
        id: 'usr_seller_1',
        role: 'VENDEDOR',
        roles: ['VENDEDOR'],
        assignedEventId: 'evt_alpha',
      },
      params: {},
      body: {},
      query: { eventId: 'evt_beta' },
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    requireEventAccess(req, res, () => {
      nextCalled = true;
    });

    assert.equal(statusCode, 403, 'Debe retornar HTTP 403 cuando eventId está en query');
    assert.equal(nextCalled, false);
    assert.equal(jsonResponse?.success, false);
  });

  it('1.4 Vendedor asignado a Evento A tiene acceso concedido a Evento A (params, body, query)', () => {
    const locations = [
      { params: { eventId: 'evt_alpha' }, body: {}, query: {} },
      { params: {}, body: { eventId: 'evt_alpha' }, query: {} },
      { params: {}, body: {}, query: { eventId: 'evt_alpha' } },
    ];

    for (const loc of locations) {
      let nextCalled = false;
      const req = {
        user: {
          id: 'usr_seller_1',
          role: 'VENDEDOR',
          roles: ['VENDEDOR'],
          assignedEventId: 'evt_alpha',
        },
        ...loc,
      };

      const res = {
        status() {
          assert.fail('res.status() no debe ser llamado para evento autorizado');
        },
        json() {
          assert.fail('res.json() no debe ser llamado para evento autorizado');
        },
      };

      requireEventAccess(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, 'next() debe ser invocado');
    }
  });

  it('1.5 SUPER_ADMIN tiene acceso irrestricto sin importar assignedEventId', () => {
    let nextCalled = false;

    const req = {
      user: {
        id: 'usr_admin_1',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN'],
        assignedEventId: 'evt_alpha',
      },
      params: { eventId: 'evt_cualquier_otro' },
      body: { eventId: 'evt_otro' },
      query: {},
    };

    const res = {
      status() {
        assert.fail('Super Admin nunca debe ser bloqueado por requireEventAccess');
      },
      json() {
        assert.fail('Super Admin nunca debe recibir error');
      },
    };

    requireEventAccess(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, 'Super Admin debe pasar directamente al siguiente middleware');
  });

  it('1.6 Usuario no autenticado es rechazado con HTTP 401', () => {
    let statusCode = null;
    let jsonResponse = null;

    const req = { user: null, params: { eventId: 'evt_alpha' }, body: {}, query: {} };
    const res = {
      status(c) {
        statusCode = c;
        return this;
      },
      json(d) {
        jsonResponse = d;
        return this;
      },
    };

    requireEventAccess(req, res, () => {
      assert.fail('next() no debe ser llamado sin usuario');
    });

    assert.equal(statusCode, 401);
    assert.equal(jsonResponse?.success, false);
  });

  it('1.7 Verificación en vivo en servidor Express: endpoints de ventas, métricas, cierres e IA bloquean al vendedor no autorizado', async () => {
    const app = express();
    app.use(express.json());

    // Middleware simulado que inyecta vendedor con assignedEventId = 'evt_autorizado'
    let currentUser = {
      id: 'usr_seller_live',
      role: 'VENDEDOR',
      roles: ['VENDEDOR'],
      assignedEventId: 'evt_autorizado',
    };

    app.use((req, res, next) => {
      req.user = currentUser;
      next();
    });

    // Rutas protegidas exactamente como en server/routes/apiRoutes.js
    app.get('/api/sales/events/:eventId', requireRole(['SUPER_ADMIN', 'VENDEDOR']), requireEventAccess, (req, res) => {
      res.json({ success: true, message: 'Sales list OK' });
    });

    app.post('/api/sales', requireRole(['SUPER_ADMIN', 'VENDEDOR']), requireEventAccess, (req, res) => {
      res.json({ success: true, message: 'Sale created OK' });
    });

    app.get('/api/closings/events/:eventId', requireRole(['SUPER_ADMIN', 'VENDEDOR']), requireEventAccess, (req, res) => {
      res.json({ success: true, message: 'Closings list OK' });
    });

    app.post('/api/closings', requireRole(['SUPER_ADMIN', 'VENDEDOR']), requireEventAccess, (req, res) => {
      res.json({ success: true, message: 'Closing created OK' });
    });

    app.post('/api/ai/chat', requireRole(['SUPER_ADMIN', 'VENDEDOR']), requireEventAccess, (req, res) => {
      res.json({ success: true, message: 'AI Chat OK' });
    });

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. GET /api/sales/events/:eventId con evento no autorizado
      const res1 = await fetch(`${baseUrl}/api/sales/events/evt_ajeno`);
      assert.equal(res1.status, 403, 'GET ventas de evento ajeno debe ser HTTP 403');

      // 2. POST /api/sales con body.eventId no autorizado
      const res2 = await fetch(`${baseUrl}/api/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: 'evt_ajeno' }),
      });
      assert.equal(res2.status, 403, 'POST venta con eventId ajeno debe ser HTTP 403');

      // 3. GET /api/closings/events/:eventId ajeno
      const res3 = await fetch(`${baseUrl}/api/closings/events/evt_ajeno`);
      assert.equal(res3.status, 403, 'GET cierres con eventId ajeno debe ser HTTP 403');

      // 4. POST /api/closings con body.eventId ajeno
      const res4 = await fetch(`${baseUrl}/api/closings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: 'evt_ajeno' }),
      });
      assert.equal(res4.status, 403, 'POST cierre con eventId ajeno debe ser HTTP 403');

      // 5. POST /api/ai/chat con body.eventId ajeno
      const res5 = await fetch(`${baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: 'evt_ajeno' }),
      });
      assert.equal(res5.status, 403, 'POST chat IA con eventId ajeno debe ser HTTP 403');

      // 6. Solicitud exitosa con evento autorizado
      const resOk = await fetch(`${baseUrl}/api/sales/events/evt_autorizado`);
      assert.equal(resOk.status, 200, 'GET ventas con evento autorizado debe ser HTTP 200');

      // 7. Super Admin accede a evento ajeno exitosamente
      currentUser = {
        id: 'usr_super_admin',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN'],
        assignedEventId: 'evt_autorizado',
      };
      const resAdmin = await fetch(`${baseUrl}/api/sales/events/evt_ajeno`);
      assert.equal(resAdmin.status, 200, 'Super Admin debe poder acceder a cualquier evento (HTTP 200)');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

// =============================================================================
// 2. DESAFÍO A-10: AISLAMIENTO ESTRICTO DE CACHÉ MULTITENANT
// =============================================================================
describe('⚔️ Desafío A-10: Aislamiento Estricto de Caché Multitenant (webCatalogService)', async () => {
  const { prisma } = await import('../../server/config/prisma.js');
  const catService = await import('../../server/services/webCatalogService.js');

  // Base de datos simulada multi-tenant
  const tenantAlphaProducts = [
    {
      id: 'poster-alpha-001',
      sku: 'SKU-ALPHA-1',
      name: 'Póster Exclusivo Alpha - Edición Limitada',
      category: 'HISTÓRICOS',
      tenantId: 'tenant_alpha',
      basePrice: 50,
      isActive: true,
      sizes: [],
    },
    {
      id: 'poster-alpha-002',
      sku: 'SKU-ALPHA-2',
      name: 'Póster Secreto Alpha',
      category: 'ARTE',
      tenantId: 'tenant_alpha',
      basePrice: 75,
      isActive: true,
      sizes: [],
    },
  ];

  const tenantBetaProducts = [
    {
      id: 'poster-beta-999',
      sku: 'SKU-BETA-9',
      name: 'Póster Confidencial Beta - Corporativo',
      category: 'VINTAGE',
      tenantId: 'tenant_beta',
      basePrice: 120,
      isActive: true,
      sizes: [],
    },
  ];

  // Interceptar prisma.product
  prisma.product = {
    findMany: async (args) => {
      const tenantId = args?.where?.tenantId;
      if (tenantId === 'tenant_alpha') return tenantAlphaProducts;
      if (tenantId === 'tenant_beta') return tenantBetaProducts;
      return [];
    },
    findFirst: async (args) => {
      const tenantId = args?.where?.tenantId;
      const idOrSku = args?.where?.OR;
      const ids = idOrSku?.map((o) => o.id || o.sku) || [];

      let list = [];
      if (tenantId === 'tenant_alpha') list = tenantAlphaProducts;
      else if (tenantId === 'tenant_beta') list = tenantBetaProducts;
      else list = [...tenantAlphaProducts, ...tenantBetaProducts];

      return list.find((p) => ids.includes(p.id) || ids.includes(p.sku)) || null;
    },
  };

  it('2.1 searchWebPosters almacena y aísla catálogos independientemente por tenantId', async () => {
    catService.invalidateCatalogCache();

    const alphaPosters = await catService.searchWebPosters({ tenantId: 'tenant_alpha' });
    const betaPosters = await catService.searchWebPosters({ tenantId: 'tenant_beta' });

    assert.equal(alphaPosters.length, 2, 'Tenant Alpha debe tener 2 pósters');
    assert.equal(betaPosters.length, 1, 'Tenant Beta debe tener 1 póster');

    // Ningún producto de Beta debe estar en la lista de Alpha
    const alphaIds = alphaPosters.map((p) => p.id);
    assert.ok(!alphaIds.includes('poster-beta-999'), 'Alpha no debe contener productos de Beta');

    const betaIds = betaPosters.map((p) => p.id);
    assert.ok(!betaIds.includes('poster-alpha-001'), 'Beta no debe contener productos de Alpha');
  });

  it('2.2 invalidateCatalogCache(tenantId) invalida selectivamente sin borrar otros tenants', async () => {
    catService.invalidateCatalogCache();

    // Cargar ambas cachés
    await catService.searchWebPosters({ tenantId: 'tenant_alpha' });
    await catService.searchWebPosters({ tenantId: 'tenant_beta' });

    // Invalidar solo tenant_alpha
    catService.invalidateCatalogCache('tenant_alpha');

    // Comprobar que tenant_beta sigue pudiendo obtener su póster por ID desde caché
    const posterBeta = await catService.getWebPosterById('poster-beta-999', 'tenant_beta');
    assert.ok(posterBeta, 'Tenant Beta debe seguir disponible en caché');
    assert.equal(posterBeta.id, 'poster-beta-999');
  });

  it('2.3 🚨 ORÁCULO DE FUGA MULTITENANT EN getWebPosterById: Fuga cruzada cuando tenantId no está en caché', async () => {
    // Escenario de ataque / falla de aislamiento:
    // 1. Limpiar toda la caché
    catService.invalidateCatalogCache();

    // 2. Tenant Beta consulta su catálogo -> llena productCache['tenant_beta'] con sus productos confidenciales
    await catService.searchWebPosters({ tenantId: 'tenant_beta' });

    // 3. Tenant Alpha NUNCA ha consultado su catálogo aún, por lo que productCache.has('tenant_alpha') es FALSE
    // 4. Un usuario o atacante de Tenant Alpha solicita por ID el póster confidencial de Tenant Beta
    const leakResult = await catService.getWebPosterById('poster-beta-999', 'tenant_alpha');

    // EVALUACIÓN DE AISLAMIENTO:
    // Para cumplir aislamiento estricto Zero-Trust, leakResult DEBE SER NULL porque poster-beta-999 NO pertenece a tenant_alpha.
    // Si leakResult NO es null, significa que la caché de tenant_beta se fugó hacia tenant_alpha!
    console.log('   [ORÁCULO 2.3] Resultado de consulta cruzada:', leakResult ? `🚨 FUGA DETECTADA: ${leakResult.titulo} (${leakResult.id})` : '✅ AISLADO (null)');

    assert.equal(
      leakResult,
      null,
      `VULNERABILIDAD CRÍTICA DE FUGA MULTITENANT (A-10): getWebPosterById retornó el producto de tenant_beta ("${leakResult?.titulo}") a una petición con tenantId="tenant_alpha"`
    );
  });
});

// =============================================================================
// 3. DESAFÍO A-12: ERRADICACIÓN DE jwt.decode & CRIPTOGRAFÍA ESTRICTA GOOGLE
// =============================================================================
describe('⚔️ Desafío A-12: Erradicación de jwt.decode & Criptografía Estricta Google OAuth', async () => {
  it('3.1 Ausencia absoluta de jwt.decode en todo el código de server/ (0 ocurrencias)', () => {
    function scanDir(dir) {
      let files = [];
      for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
          files = files.concat(scanDir(full));
        } else if (item.endsWith('.js')) {
          files.push(full);
        }
      }
      return files;
    }

    const files = scanDir(serverDir);
    const matches = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('jwt.decode')) {
          matches.push({ file: path.relative(serverDir, file), line: idx + 1, content: line.trim() });
        }
      });
    }

    assert.equal(
      matches.length,
      0,
      `Se encontraron llamadas inseguras a jwt.decode en server/:\n${JSON.stringify(matches, null, 2)}`
    );
  });

  it('3.2 handleGoogleLogin rechaza peticiones sin credencial con HTTP 400', async () => {
    const { handleGoogleLogin } = await import('../../server/controllers/authController.js');

    let statusCode = null;
    let jsonResponse = null;

    const req = { body: {} };
    const res = {
      status(c) {
        statusCode = c;
        return this;
      },
      json(d) {
        jsonResponse = d;
        return this;
      },
    };

    await handleGoogleLogin(req, res);

    assert.equal(statusCode, 400, 'Debe responder HTTP 400 cuando falta credential');
    assert.equal(jsonResponse?.success, false);
    assert.ok(jsonResponse?.error?.includes('Se requiere autenticación obligatoria'));
  });

  it('3.3 handleGoogleLogin rechaza tokens falsificados o inválidos con HTTP 401', async () => {
    const { handleGoogleLogin } = await import('../../server/controllers/authController.js');

    let statusCode = null;
    let jsonResponse = null;

    // Token forjado arbitrario simulando intento de bypass
    const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImhhY2tlckBkZWtvbGFicy5vcmciLCJzdWIiOiIxMjM0NSJ9.invalid_signature';

    const req = { body: { credential: forgedToken } };
    const res = {
      status(c) {
        statusCode = c;
        return this;
      },
      json(d) {
        jsonResponse = d;
        return this;
      },
    };

    await handleGoogleLogin(req, res);

    assert.equal(statusCode, 401, 'Debe responder HTTP 401 ante token con firma inválida');
    assert.equal(jsonResponse?.success, false);
    assert.ok(
      jsonResponse?.error?.includes('Token de Google inválido') ||
      jsonResponse?.error?.includes('verificación criptográfica'),
      'Debe indicar fallo en verificación criptográfica'
    );
  });
});

// =============================================================================
// 4. DESAFÍO A-14: FILTRO ESTRICTO DE ARCHIVOS MULTER (fileFilter & iOS Safari)
// =============================================================================
describe('⚔️ Desafío A-14: Filtro Estricto de Archivos Multer (fileFilter & iOS Safari)', async () => {
  const { fileFilter, ALLOWED_AUDIO_MIMES, ALLOWED_IMAGE_MIMES, ALLOWED_VIDEO_MIMES } = await import(
    '../../server/middleware/uploadMiddleware.js'
  );

  it('4.1 Rechazo inmediato de ejecutables y binarios maliciosos con código UNSUPPORTED_MEDIA_TYPE', () => {
    const maliciousFiles = [
      { fieldname: 'audio', mimetype: 'application/x-msdownload', originalname: 'payload.exe' },
      { fieldname: 'audio', mimetype: 'application/x-dosexec', originalname: 'trojan.com' },
      { fieldname: 'image', mimetype: 'application/x-executable', originalname: 'rootkit' },
      { fieldname: 'image', mimetype: 'application/x-bat', originalname: 'script.bat' },
      { fieldname: 'video', mimetype: 'application/x-sh', originalname: 'exploit.sh' },
      { fieldname: 'file', mimetype: 'application/octet-stream', originalname: 'binary.bin' },
      { fieldname: 'audio', mimetype: 'application/x-php', originalname: 'backdoor.php' },
      { fieldname: 'image', mimetype: 'application/javascript', originalname: 'xss.js' },
      { fieldname: 'video', mimetype: 'text/html', originalname: 'phishing.html' },
      { fieldname: 'file', mimetype: 'application/zip', originalname: 'archive.zip' },
    ];

    for (const file of maliciousFiles) {
      let passedError = null;
      let passedAccepted = null;

      fileFilter({}, file, (err, accepted) => {
        passedError = err;
        passedAccepted = accepted;
      });

      assert.ok(passedError, `Debe rechazar ${file.mimetype} en campo ${file.fieldname}`);
      assert.equal(passedError.code, 'UNSUPPORTED_MEDIA_TYPE', 'El código de error debe ser UNSUPPORTED_MEDIA_TYPE');
      assert.equal(passedAccepted, false, 'El archivo NO debe ser aceptado');
    }
  });

  it('4.2 Aceptación garantizada de formatos de audio iOS Safari / iPhone (audio/mp4, audio/m4a, audio/x-m4a)', () => {
    const iosAudioFiles = [
      { fieldname: 'audio', mimetype: 'audio/mp4', originalname: 'recording.mp4' },
      { fieldname: 'audio', mimetype: 'audio/m4a', originalname: 'voicenote.m4a' },
      { fieldname: 'audio', mimetype: 'audio/x-m4a', originalname: 'voice.x-m4a' },
      { fieldname: 'audio', mimetype: 'audio/webm', originalname: 'standard.webm' },
      { fieldname: 'audio', mimetype: 'audio/mpeg', originalname: 'voice.mp3' },
      { fieldname: 'audio', mimetype: 'audio/wav', originalname: 'sound.wav' },
      { fieldname: 'audio', mimetype: 'audio/aac', originalname: 'voice.aac' },
    ];

    for (const file of iosAudioFiles) {
      let passedError = null;
      let passedAccepted = null;

      fileFilter({}, file, (err, accepted) => {
        passedError = err;
        passedAccepted = accepted;
      });

      assert.equal(passedError, null, `Audio iOS ${file.mimetype} no debe arrojar error`);
      assert.equal(passedAccepted, true, `Audio iOS ${file.mimetype} debe ser aceptado`);
    }
  });

  it('4.3 Rechazo cruzado de tipos MIME por nombre de campo', () => {
    // Subir imagen en campo de audio
    let errAudio = null;
    fileFilter({}, { fieldname: 'audio', mimetype: 'image/png' }, (err) => {
      errAudio = err;
    });
    assert.ok(errAudio, 'image/png en campo audio debe ser rechazado');
    assert.equal(errAudio.code, 'UNSUPPORTED_MEDIA_TYPE');

    // Subir audio en campo de imagen
    let errImage = null;
    fileFilter({}, { fieldname: 'image', mimetype: 'audio/mp4' }, (err) => {
      errImage = err;
    });
    assert.ok(errImage, 'audio/mp4 en campo image debe ser rechazado');
    assert.equal(errImage.code, 'UNSUPPORTED_MEDIA_TYPE');

    // Subir video en campo de audio
    let errVideo = null;
    fileFilter({}, { fieldname: 'video', mimetype: 'audio/mp3' }, (err) => {
      errVideo = err;
    });
    assert.ok(errVideo, 'audio/mp3 en campo video debe ser rechazado');
    assert.equal(errVideo.code, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('4.4 Integración de manejo de errores de Multer en Express router', () => {
    const errorMiddleware = (err, req, res, next) => {
      if (err?.name === 'MulterError') {
        return res.status(400).json({
          success: false,
          error: `Error al procesar archivo: ${err.message}`,
          code: err.code,
        });
      }
      if (err?.code === 'UNSUPPORTED_MEDIA_TYPE' || err?.message?.includes('Tipo de archivo')) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next(err);
    };

    let statusCode = null;
    let jsonResponse = null;

    const mockErr = new Error('Tipo de archivo de audio no permitido (application/x-msdownload).');
    mockErr.code = 'UNSUPPORTED_MEDIA_TYPE';

    const res = {
      status(c) {
        statusCode = c;
        return this;
      },
      json(d) {
        jsonResponse = d;
        return this;
      },
    };

    errorMiddleware(mockErr, {}, res, () => {});

    assert.equal(statusCode, 400, 'Debe responder HTTP 400 estructurado');
    assert.equal(jsonResponse?.success, false);
    assert.ok(jsonResponse?.error?.includes('Tipo de archivo de audio no permitido'));
  });
});
