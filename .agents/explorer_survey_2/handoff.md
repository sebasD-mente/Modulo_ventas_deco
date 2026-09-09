# Handoff Report — Explorer Survey Phase 2: Security, Concurrency, SQL & Isolation

**Author**: `explorer_survey_2`  
**Working Directory**: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/explorer_survey_2`  
**Target Recipient**: `parent` (`40958512-4854-45d9-bf41-45feacb902c8`)  
**Date**: 2026-09-09T14:28:00Z  
**Scope**:
1. API Security & Auth Middleware (R2)
2. Sales Concurrency & Number Generation (R2)
3. Raw SQL Queries (R2)
4. Database Isolation & Decoupled Sync (R5)

---

## 1. Observation

### 1.1 API Security & Auth Middleware (`server/middleware/authMiddleware.js` & `server/routes/apiRoutes.js`)
* **File**: `server/middleware/authMiddleware.js`
* **Lines 6–18**:
  ```javascript
  6:   const authHeader = req.headers.authorization;
  7: 
  8:   if (authHeader && authHeader.startsWith('Bearer ')) {
  9:     const token = authHeader.split(' ')[1];
  10:     try {
  11:       const decoded = jwt.verify(token, ENV.JWT_SECRET);
  12:       req.user = decoded;
  13:       req.tenantId = decoded.tenantId;
  14:       return next();
  15:     } catch (err) {
  16:       return res.status(401).json({ success: false, error: 'Token de autenticación expirado o inválido.' });
  17:     }
  18:   }
  ```
* **Lines 20–42** (Critical Flaw):
  ```javascript
  20:   // Fallback para desarrollo / stand si no hay token explícito
  21:   if (ENV.NODE_ENV === 'development' || !authHeader) {
  22:     try {
  23:       const defaultUser = await prisma.user.findFirst({
  24:         where: { role: 'ENCARGADO_STAND' },
  25:         include: { tenant: true },
  26:       });
  27: 
  28:       if (defaultUser) {
  29:         req.user = {
  30:           id: defaultUser.id,
  31:           email: defaultUser.email,
  32:           fullName: defaultUser.fullName,
  33:           role: defaultUser.role,
  34:           tenantId: defaultUser.tenantId,
  35:         };
  36:         req.tenantId = defaultUser.tenantId;
  37:         return next();
  38:       }
  39:     } catch (err) {
  40:       console.warn('[AuthMiddleware Warning] ⚠️ Error obteniendo usuario por defecto:', err.message);
  41:     }
  42:   }
  ```
* **Route Protection Scope**:
  * In `server/index.js`, line 38 mounts the router: `app.use('/api', apiRoutes);`.
  * In `server/routes/apiRoutes.js`, line 34 applies the middleware globally to all API routes: `router.use(authMiddleware);`.
  * Every API endpoint is mounted under `/api` and depends directly on `authMiddleware`:
    * Catálogo / Eventos: `GET /api/events/active`, `GET /api/events`, `POST /api/events`, `PATCH /api/events/:id/activate`, `GET /api/products`, `GET /api/catalog/web-posters`
    * Ventas y Métricas: `POST /api/sales`, `PATCH /api/sales/:id`, `GET /api/sales/events/:eventId`, `GET /api/sales/events/:eventId/metrics`, `GET /api/sales/monitor`
    * Arqueos de Caja: `POST /api/closings`, `GET /api/closings/events/:eventId`
    * Endpoints IA Multimodal: `POST /api/ai/voice-sale`, `POST /api/ai/batch-photo`, `POST /api/ai/recognize-artwork`, `POST /api/ai/recognize-video`, `POST /api/ai/chat`
  * In `server/index.js`, the only unauthenticated endpoints are:
    * `GET /health` (Lines 33–35)
    * `GET /uploads/*` (Line 30)
    * Static files in `dist/` (Lines 41–52)

### 1.2 Sales Concurrency & Number Generation (`server/services/saleService.js`)
* **File**: `server/services/saleService.js`
* **Lines 6–19**:
  ```javascript
  6: export async function generateSaleNumber(eventId) {
  7:   const count = await prisma.sale.count({
  8:     where: { eventId },
  9:   });
  10:   const event = await prisma.event.findUnique({
  11:     where: { id: eventId },
  12:     select: { name: true },
  13:   });
  14:   const prefix = event?.name
  15:     ? event.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()
  16:     : 'VENTA';
  17:   const sequential = String(count + 1).padStart(4, '0');
  18:   return `${prefix}-${sequential}`;
  19: }
  ```
* **Execution Context in `createSaleTransaction`** (Lines 35, 59, 62):
  ```javascript
  35:   return await prisma.$transaction(async (tx) => {
  ...
  59:     const saleNumber = await generateSaleNumber(eventId);
  62:     const sale = await tx.sale.create({
  ...
  67:         saleNumber,
  ```
* **Database Constraint** (`prisma/schema.prisma` Line 121):
  ```prisma
  121:   @@unique([eventId, saleNumber])
  ```

### 1.3 Raw SQL Queries (`server/services/webCatalogService.js`)
* **Grep Results across `server/`**:
  * `$executeRaw`: 0 occurrences.
  * `$queryRaw` / `$queryRawUnsafe`: Exactly 5 occurrences, ALL confined to `server/services/webCatalogService.js`.
* **String Interpolation in `server/services/webCatalogService.js`**:
  * Lines 57–63:
    ```javascript
    57:     const posterIds = posters.map(p => `'${p.id}'`).join(',');
    58:     const sizes = await prisma.$queryRawUnsafe(`
    59:       SELECT "posterId", "sizeId", "nombre", "dimensiones", "precio"
    60:       FROM public.poster_sizes
    61:       WHERE "posterId" IN (${posterIds}) AND "isActive" = true
    62:       ORDER BY "precio" ASC;
    63:     `);
    ```
    `posterIds` is constructed by joining strings with single quotes and interpolated directly into the SQL query string passed to `$queryRawUnsafe`.
  * Line 99: `$queryRawUnsafe` with hardcoded query on `public.posters`.
  * Lines 119, 128: `$queryRawUnsafe` with parameter `$1` querying `public.posters` and `public.poster_sizes`.

### 1.4 Database Isolation & Decoupled Sync (`.env` & `prisma/schema.prisma`)
* **File**: `.env`
* **Line 3**:
  ```env
  DATABASE_URL=postgresql://admin_deco:DecoVintage_DB_2026_Secur@145.223.120.56:5432/catalog_db?schema=event_sales
  ```
  The database connection is currently pointing directly to `catalog_db` with a secondary PostgreSQL schema `schema=event_sales`.
* **`prisma/schema.prisma` Models**:
  * Defined models: `Tenant`, `User`, `Event`, `Product`, `Sale`, `SaleItem`, `SalePayment`, `SaleAttachment`, `CashClosing`, `AuditLog`.
  * Does NOT define `posters` or `poster_sizes`. `webCatalogService.js` was relying on cross-schema visibility into `catalog_db`'s `public` schema.
* **External Web Catalog Contract**:
  * Inspected `c:\Users\sebas\Documents\Antigravity Files\Web Deco Vintage Proyect\routes\catalogRoutes.js` (Lines 219–265) and `services/catalogService.js` (Lines 117–145).
  * Web project exposes `GET /api/catalog/posters` (Public, unauthenticated).
  * Returns JSON payload:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "uuid",
          "titulo": "Five Nights at Freddy's",
          "categoria": "VIDEO_JUEGOS",
          "imageUrl": "https://storage.googleapis.com/...",
          "thumbUrl": "https://storage.googleapis.com/...",
          "precioMinimo": 25,
          "tags": ["fnaf", "horror"],
          "sizes": [
            { "sizeId": "MINI", "nombre": "Mini", "dimensiones": "20 x 30 cm", "precio": 25 },
            { "sizeId": "MEDIANO", "nombre": "Mediano", "dimensiones": "30 x 45 cm", "precio": 65 }
          ]
        }
      ],
      "count": 233
    }
    ```
  * In `Modulo_Ventas`, there is currently NO `server/services/catalogSyncService.js`.

---

## 2. Logic Chain

### 2.1 API Security & Auth Bypass Logic
1. Line 21 of `server/middleware/authMiddleware.js` uses a logical OR: `if (ENV.NODE_ENV === 'development' || !authHeader)`.
2. In production (`ENV.NODE_ENV === 'production'`), if any client sends an HTTP request without an `Authorization` header, `authHeader` is `undefined`.
3. Consequently, `!authHeader` evaluates to `true`. The condition `false || true` yields `true`.
4. The code enters the fallback block (lines 22–38), queries `prisma.user.findFirst({ where: { role: 'ENCARGADO_STAND' } })`, injects this identity into `req.user` and `req.tenantId`, and calls `next()`.
5. Because `router.use(authMiddleware)` guards all `/api` routes (Observation 1.1), any unauthenticated external entity can invoke all administrative, sales, cash closing, and AI endpoints without providing credentials.
6. Removing `|| !authHeader` ensures the condition is strictly `if (ENV.NODE_ENV === 'development')`. In production, any request lacking a valid Bearer JWT will bypass this block and fall through to line 44: `res.status(401).json({ success: false, error: 'No autorizado. Se requiere inicio de sesión.' })`.

### 2.2 Race Condition & Collision Logic in Sales Concurrency
1. In `server/services/saleService.js`, `createSaleTransaction` runs inside `prisma.$transaction(async (tx) => { ... })`.
2. However, line 59 calls `generateSaleNumber(eventId)` which executes `prisma.sale.count({ where: { eventId } })` on the global Prisma instance outside the transaction client `tx`.
3. Under PostgreSQL Read Committed isolation, even if `tx.sale.count` were used, simultaneous transactions cannot see uncommitted rows created by other concurrent transactions.
4. When two or more cashiers at a busy convention (e.g. Comic Con Majadas) finalize sales within the same millisecond window:
   - Cashier A executes `count` -> gets 15 -> computes `sequential = '0016'` -> `saleNumber = 'COMI-0016'`.
   - Cashier B executes `count` concurrently -> gets 15 -> computes `sequential = '0016'` -> `saleNumber = 'COMI-0016'`.
5. Both transactions attempt `tx.sale.create({ data: { eventId, saleNumber: 'COMI-0016', ... } })`.
6. Database constraint `@@unique([eventId, saleNumber])` (Observation 1.2) rejects the second insert, throwing Prisma error `P2002` (`Unique constraint failed on the fields: (eventId, saleNumber)`).
7. The second cashier's POS sale crashes with a 400/500 error, blocking the checkout line.
8. Furthermore, if any past sale is soft-deleted or removed, `count + 1` regresses and collides with existing physical receipts.

### 2.3 Raw SQL Injection Risk Logic
1. In `server/services/webCatalogService.js` (lines 57–63), `posters.map(p => `'${p.id}'`).join(',')` dynamically generates a raw string of IDs and interpolates it directly into `$queryRawUnsafe` using ES6 template literal `${posterIds}`.
2. Even if `p.id` originates from an earlier query, template interpolation into `$queryRawUnsafe` violates safe SQL coding standards, bypasses SQL parse trees, and risks SQL injection if any ID contains malicious payload or special escape characters.
3. PostgreSQL natively supports parameterized array matching via `= ANY($1::text[])` or `IN (SELECT unnest($1::text[]))`.
4. Most critically, because `deko_eventsales_db` is isolated from `catalog_db`, `public.posters` and `public.poster_sizes` will not exist in the sales database at all. Maintaining raw SQL queries against non-existent tables is architectural debt.

### 2.4 Database Isolation & Decoupled Sync Logic
1. `.env` line 3 connects to `catalog_db?schema=event_sales`. This violates Section 2 of `aislamiento-estricto-proyectos`: cohabiting tables or schemas within the e-commerce database couples the POS to the web store, creating shared connection pool risks, maintenance lockouts, and backup interdependencies.
2. The sales module must connect strictly to its own dedicated database: `deko_eventsales_db`.
3. Because `deko_eventsales_db` will not have `public.posters`, querying `public.posters` via raw SQL will fail with PostgreSQL error `42P01: relation "public.posters" does not exist`.
4. To fulfill Section 3 of `aislamiento-estricto-proyectos` ("Copia / Réplica Local Desacoplada"):
   - The standalone `Product` table in `deko_eventsales_db` must serve as the single source of truth for the POS.
   - `catalogSyncService.js` must fetch the web catalog via HTTP (`GET /api/catalog/posters` from `https://decovintageguate.com`) and upsert items into the local `Product` model.
   - If the convention hall has intermittent or zero internet connectivity, the local POS continues operating seamlessly with cached local products.
   - `webCatalogService.js` should be refactored to query `prisma.product` using type-safe Prisma queries, completely eliminating raw SQL and foreign schema couplings while preserving the JSON contract expected by `FastManualSaleForm.jsx`.

---

## 3. Caveats

1. **Live Dokploy Environment & Credentials**: Production Dokploy instance provisioning for `deko_eventsales_db` (creating the PostgreSQL container/service and assigning dedicated user roles) must be performed in Dokploy or via PostgreSQL admin commands; this subagent operates in read-only survey mode and did not execute DDL on remote hosts.
2. **Catalog Image Storage**: The images returned by `GET /api/catalog/posters` point to GCS (`https://storage.googleapis.com/...`) or web CDN URLs. Offline display of images requires browser caching or local asset caching if total offline mode is required.
3. **No other service raw SQL**: A full grep confirmed no other raw SQL exists in `server/`.

---

## 4. Conclusion & Actionable Architectural Strategy

### 4.1 Solution for API Security (R2)
In `server/middleware/authMiddleware.js`, modify line 21 from:
```javascript
// BEFORE (Vulnerable):
if (ENV.NODE_ENV === 'development' || !authHeader) {
```
to:
```javascript
// AFTER (Secure):
if (ENV.NODE_ENV === 'development') {
```
*Rationale*:
In development, it preserves developer convenience if no token is passed. In production (`ENV.NODE_ENV === 'production'`), requests without a Bearer token skip lines 8–18 and lines 21–42, terminating at line 44 with HTTP 401.

### 4.2 Solution for Sales Concurrency (R2) — Atomic Row-Level Lock Strategy
Refactor `Event` model in `prisma/schema.prisma` to include an atomic sequence counter:
```prisma
model Event {
  id                  String        @id @default(uuid())
  ...
  currentSaleSequence Int           @default(0) @map("current_sale_sequence")
  ...
}
```
In `server/services/saleService.js`, execute the increment atomically inside the existing transaction `tx`:
```javascript
export async function createSaleTransaction({ tenantId, sellerId, eventId, items, payments, discount = 0, notes = null, inputChannel = 'MANUAL_POS', attachments = [] }) {
  return await prisma.$transaction(async (tx) => {
    // 1. Atomic sequence increment with exclusive row-level lock on Event
    const updatedEvent = await tx.event.update({
      where: { id: eventId },
      data: { currentSaleSequence: { increment: 1 } },
      select: { name: true, currentSaleSequence: true },
    });

    const prefix = updatedEvent.name
      ? updatedEvent.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()
      : 'VENTA';
    const sequential = String(updatedEvent.currentSaleSequence).padStart(4, '0');
    const saleNumber = `${prefix}-${sequential}`;

    // 2. Proceed with tx.sale.create using guaranteed unique saleNumber
    const sale = await tx.sale.create({
      data: {
        tenantId,
        eventId,
        sellerId,
        saleNumber,
        ...
      }
    });
    ...
  });
}
```
*Why this is the zero-debt solution*:
- In PostgreSQL, `UPDATE events SET current_sale_sequence = current_sale_sequence + 1 WHERE id = $1` acquires a row-level write lock (`FOR UPDATE`).
- Concurrent sellers are queued sequentially by the database engine without deadlocks.
- Eliminates the race condition, eliminates collisions, avoids `COUNT(*)` table scans, and runs in $O(1)$ time.

### 4.3 Solution for Raw SQL & Database Isolation (R2, R5)
1. **Database URL Update (`.env`)**:
   ```env
   DATABASE_URL=postgresql://admin_deco:DecoVintage_DB_2026_Secur@145.223.120.56:5432/deko_eventsales_db?schema=public
   ```
2. **Extend `Product` model in `prisma/schema.prisma`**:
   Add `sizes Json? @default("[]")` and `tags String[] @default([])` to `Product`:
   ```prisma
   model Product {
     id          String     @id @default(uuid())
     tenantId    String
     tenant      Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
     sku         String?
     name        String
     category    String     @default("GENERAL")
     basePrice   Decimal    @db.Decimal(10, 2)
     imageUrl    String?
     sizes       Json?      @default("[]")
     tags        String[]   @default([])
     qrCodeData  String?
     barcode     String?
     isActive    Boolean    @default(true)
     createdAt   DateTime   @default(now())
     updatedAt   DateTime   @updatedAt

     saleItems   SaleItem[]

     @@unique([tenantId, sku])
     @@index([tenantId, category])
     @@index([tenantId, barcode])
     @@map("products")
   }
   ```
3. **Architecture of `server/services/catalogSyncService.js`**:
   ```javascript
   import fetch from 'node-fetch'; // or global fetch in Node 22
   import { prisma } from '../config/prisma.js';
   import { ENV } from '../config/env.js';

   export async function syncCatalogFromWeb(tenantId) {
     const webCatalogUrl = process.env.WEB_CATALOG_URL || 'https://decovintageguate.com';
     console.log(`[CatalogSync] Sincronizando catálogo desde ${webCatalogUrl}/api/catalog/posters...`);

     try {
       const res = await fetch(`${webCatalogUrl}/api/catalog/posters?take=500`, {
         headers: { 'Accept': 'application/json' },
         timeout: 10000,
       });

       if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
       const json = await res.json();
       const posters = json.data || json.posters || [];

       let upsertedCount = 0;
       for (const p of posters) {
         const sku = `WEB-${p.id}`;
         await prisma.product.upsert({
           where: { tenantId_sku: { tenantId, sku } },
           create: {
             tenantId,
             sku,
             name: p.titulo,
             category: p.categoria || 'GENERAL',
             basePrice: Number(p.precioMinimo || (p.sizes?.[0]?.precio || 25)),
             imageUrl: p.imageUrl || null,
             sizes: p.sizes || [],
             tags: p.tags || [],
             isActive: true,
           },
           update: {
             name: p.titulo,
             category: p.categoria || 'GENERAL',
             basePrice: Number(p.precioMinimo || (p.sizes?.[0]?.precio || 25)),
             imageUrl: p.imageUrl || null,
             sizes: p.sizes || [],
             tags: p.tags || [],
             isActive: true,
           }
         });
         upsertedCount++;
       }

       console.log(`[CatalogSync] ✅ Sincronización exitosa: ${upsertedCount} pósters actualizados en base local.`);
       return { success: true, count: upsertedCount };
     } catch (err) {
       console.warn(`[CatalogSync] ⚠️ Error en sincronización: ${err.message}. El stand continuará con el catálogo local existente.`);
       return { success: false, error: err.message };
     }
   }
   ```
4. **Refactor `server/services/webCatalogService.js`**:
   Replace all raw `$queryRawUnsafe` calls with Prisma model queries on `prisma.product`:
   ```javascript
   export async function searchWebPosters({ tenantId, query = '', category = null, limit = 24 }) {
     const where = {
       isActive: true,
       ...(tenantId ? { tenantId } : {}),
       ...(category ? { category } : {}),
       ...(query.trim() ? {
         OR: [
           { name: { contains: query.trim(), mode: 'insensitive' } },
           { tags: { has: query.trim().toLowerCase() } },
         ]
       } : {}),
     };

     const products = await prisma.product.findMany({
       where,
       take: limit,
       orderBy: { name: 'asc' },
     });

     return products.map(p => ({
       id: p.id,
       titulo: p.name,
       categoria: p.category,
       imageUrl: p.imageUrl,
       thumbUrl: p.imageUrl,
       precioMinimo: Number(p.basePrice),
       tags: p.tags,
       sizes: p.sizes || [{ sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', precio: Number(p.basePrice) }],
     }));
   }
   ```
   *Benefit*: Complete eradication of raw SQL strings, full compliance with `aislamiento-estricto-proyectos`, and seamless preservation of the React frontend contract.

---

## 5. Verification Method

### 5.1 Verifying API Security & Auth Bypass
1. Run local Express server with `NODE_ENV=production node server/index.js`.
2. Send unauthenticated test requests:
   ```bash
   # Test protected endpoint without Authorization header
   curl -i -X GET http://localhost:3001/api/events/active
   # EXPECTED: HTTP/1.1 401 Unauthorized
   # Response body: {"success":false,"error":"No autorizado. Se requiere inicio de sesión."}

   # Test with invalid token
   curl -i -X GET http://localhost:3001/api/events/active -H "Authorization: Bearer invalid_token"
   # EXPECTED: HTTP/1.1 401 Unauthorized
   ```
3. Invalidation condition: If any response returns HTTP 200 with `defaultUser`, verification fails.

### 5.2 Verifying Sales Concurrency
1. Execute a simulated parallel stress test using `Promise.all`:
   ```javascript
   const results = await Promise.all(
     Array.from({ length: 10 }).map((_, i) =>
       createSaleTransaction({
         tenantId,
         sellerId,
         eventId,
         items: [{ description: 'Poster Test', quantity: 1, unitPrice: 45 }],
         payments: [{ method: 'EFECTIVO', amount: 45 }],
       })
     )
   );
   const saleNumbers = results.map(r => r.saleNumber);
   const uniqueNumbers = new Set(saleNumbers);
   assert.strictEqual(uniqueNumbers.size, 10, 'All sale numbers must be unique');
   ```
2. Invalidation condition: Any duplicate `saleNumber` or Prisma error `P2002` invalidates the fix.

### 5.3 Verifying SQL Parameterization & Database Isolation
1. Run `grep -rn "\$queryRawUnsafe" server/` -> must return 0 results after refactoring.
2. Confirm PostgreSQL connection string in `.env` targets `deko_eventsales_db` and no references to `catalog_db` or `schema=event_sales` remain.
3. Test `syncCatalogFromWeb` -> verify records populate `prisma.product` and can be retrieved via `GET /api/catalog/web-posters?q=Spider`.
