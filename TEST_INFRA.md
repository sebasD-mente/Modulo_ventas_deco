# Deko EventSales — E2E Test Infrastructure & Specification

## 1. Test Philosophy & Principles

The Deko EventSales end-to-end (E2E) testing framework is constructed upon strict **opaque-box (black-box)** and **requirement-driven** methodologies:

1. **Opaque-Box Verification**: The test suite treats the entire backend API as an opaque service. Tests interact solely through observable interfaces (HTTP requests, headers, response status codes, payload structures, database effects, and cloud storage URLs) without relying on internal variable states or transient memory structures.
2. **Authoritative Specification Derivation**: Every test assertion maps directly to requirements formulated in `ORIGINAL_REQUEST.md`, architectural contracts defined in `PROJECT.md`, and strict business rules (`saleValidators.js`, `aislamiento-estricto-proyectos`, and `cirugia-arquitectura-cero-deuda`).
3. **Cero Suposiciones (Zero Assumptions)**: No test succeeds through mocking illusions or superficial facades. The tests execute against the live HTTP runtime and real PostgreSQL persistence layer, enforcing real-world data fidelity.
4. **Idempotency & Isolation**: Each test scenario generates unique identifiers, uses transactional boundaries or isolated fixture entities, and avoids corrupting peer test data.
5. **Zero Code Changes in Implementation**: The test writer acts under strict QA discipline — no implementation code is altered. System bugs, regressions, and specification violations are surfaced, isolated, and escalated.

---

## 2. 4-Tier Test Architecture Overview

```
+-----------------------------------------------------------------------------+
|                      TIER 4: REAL-WORLD SCENARIOS                           |
|  Complete Multi-Step Event Lifecycle: Prep -> Search -> Sale -> KPIs -> Close |
+-----------------------------------------------------------------------------+
                                      ^
+-----------------------------------------------------------------------------+
|                  TIER 3: CROSS-FEATURE COMBINATIONS                         |
|  Auth + Active Event + Sale | Catalog Sync + Search | Storage + Attachment  |
+-----------------------------------------------------------------------------+
                                      ^
+-----------------------------------------------------------------------------+
|                  TIER 2: BOUNDARY & CORNER CASES                            |
|  Auth Bypass Prevention | Token Tampering | Negative Numbers | Concurrency  |
+-----------------------------------------------------------------------------+
                                      ^
+-----------------------------------------------------------------------------+
|                  TIER 1: FEATURE COVERAGE (>=5 tests / feature)             |
|  API Auth (5+) | Sales POS (5+) | Catalog (5+) | Storage (5+) | Health (5+) |
+-----------------------------------------------------------------------------+
```

---

## 3. Detailed Tier Specifications

### Tier 1: Feature Coverage (Unit-to-Service Level through HTTP)
*Objective: Guarantee complete baseline functional coverage across the 5 architectural pillars. Minimum 5 test cases per feature (Total >= 25 tests).*

#### Feature 1: API Authentication & Token Lifecycle (`tests/e2e/tier1-features.test.js`)
- **T1.1.1 — Valid Bearer JWT Acceptance**: Valid JWT with tenant and user claims returns HTTP 200/201 on guarded endpoints.
- **T1.1.2 — Expired JWT Token Rejection**: Token signed with expired timestamp (`exp < now`) receives HTTP 401 with `{ success: false, error: 'Token de autenticación expirado o inválido.' }`.
- **T1.1.3 — Invalid Signature Rejection**: Token signed with an alien secret key receives HTTP 401.
- **T1.1.4 — Malformed Header Syntax**: Authorization headers missing the `Bearer ` prefix (e.g. raw token or Basic auth) are rejected with HTTP 401 in production security mode.
- **T1.1.5 — Tenant Context Injection**: Identity properties (`tenantId`, `user.id`, `user.role`) are properly decoded and injected into the execution context.

#### Feature 2: Sales Creation & POS Transaction Processing
- **T1.2.1 — Standard Cash Sale**: Single item POS transaction with `EFECTIVO` payment generates unique `saleNumber` and returns HTTP 201.
- **T1.2.2 — Multi-Item Card Sale**: Multi-line item transaction with `TARJETA` payment correctly aggregates total amounts and individual line totals.
- **T1.2.3 — Discount Calculation**: Applied positive discount correctly reduces the net `totalAmount`.
- **T1.2.4 — Input Channel Diversity**: POS supports diverse input channels (`MANUAL_POS`, `MANUAL_RAPIDA`, `IA_VOZ`, `IA_IMAGEN_QR`, `IA_TEXTO`).
- **T1.2.5 — Transaction Notes & References**: Customer notes and payment reference codes are durably stored in the database.

#### Feature 3: Catalog Synchronization & Search
- **T1.3.1 — Public Catalog Schema Compliance**: Validation of the external contract (`id`, `titulo`, `categoria`, `imageUrl`, `sizes`, `tags`).
- **T1.3.2 — Active Product Listing**: `GET /api/products` returns active merchandise records matching the tenant.
- **T1.3.3 — Text Search Query**: `GET /api/catalog/web-posters?q=...` searches titles and tags case-insensitively.
- **T1.3.4 — Category Filter**: Querying with `category=SUPERHEROES` filters results exclusively to that domain.
- **T1.3.5 — Result Pagination/Limit**: `limit` query parameter accurately caps the maximum number of items returned.

#### Feature 4: Cloud Storage & Media Persistence
- **T1.4.1 — Storage Contract Response**: Upload operations return `{ success: true, url, filename }`.
- **T1.4.2 — Google Cloud Storage URL Structure**: Public URLs conform to `https://storage.googleapis.com/{BUCKET_NAME}/{folder}/{filename}`.
- **T1.4.3 — Directory Segregation**: Uploads partition files into appropriate namespaces (`sales/`, `receipts/`, `audio/`).
- **T1.4.4 — Media Type Content Handling**: Binary image and audio buffers are processed with appropriate content types.
- **T1.4.5 — Fail-Fast Behavior on Failure**: In production, storage service rejects silent fallbacks to ephemeral disk if cloud upload fails.

#### Feature 5: Health Check & System Observability
- **T1.5.1 — Health Check Availability**: `GET /health` returns HTTP 200 OK.
- **T1.5.2 — Health Payload Structure**: Response contains `status: 'ok'`, ISO timestamp `time`, and environment `env`.
- **T1.5.3 — Latency SLA Verification**: Health check resolves in under 500ms.
- **T1.5.4 — Method Not Allowed / Route Protection**: Unsupported HTTP methods (e.g. `POST /health`) return client error (404/405).
- **T1.5.5 — Database Connectivity Check**: Health observability reports live database health status.

---

### Tier 2: Boundary & Corner Cases (`tests/e2e/tier2-boundary.test.js`)
*Objective: Stress-test input validation schemas (Zod), reject corrupted/adversarial payloads, and verify race condition resistance.*

- **T2.1 — Unauthorized Requests**: Endpoints accessed without `Authorization` header receive HTTP 401.
- **T2.2 — Corrupted Tokens**: Truncated or syntactically invalid JWT strings receive HTTP 401.
- **T2.3 — Missing Required Fields**:
  - Missing `eventId` -> HTTP 400 with validation details.
  - Empty `items: []` -> HTTP 400 ("La venta debe incluir al menos un producto").
  - Empty `payments: []` -> HTTP 400 ("Debe especificarse al menos un método de pago").
  - Completely empty body `{}` -> HTTP 400.
- **T2.4 — Zero & Negative Numerical Values**:
  - `quantity: 0` or `quantity: -5` -> HTTP 400.
  - `unitPrice: -10` -> HTTP 400.
  - `amount: 0` or `amount: -25` in payments -> HTTP 400.
  - Negative discount (`discount: -50`) -> HTTP 400.
- **T2.5 — String Length & Format Boundaries**:
  - Non-UUID format for `eventId` -> HTTP 400.
  - `notes` string exceeding 500 characters -> HTTP 400.
  - `observations` in cash closing exceeding 1000 characters -> HTTP 400.
- **T2.6 — Invalid Enum Values**:
  - Unsupported payment method (`method: 'CRYPTO'`) -> HTTP 400.
  - Unsupported input channel (`inputChannel: 'TELEPATHY'`) -> HTTP 400.
- **T2.7 — High-Concurrency Race Condition Simulation**:
  - 10 simultaneous sales transactions fired in parallel (`Promise.all`) targeting the same event.
  - Asserts that all transactions complete successfully (zero `P2002` collisions) and every `saleNumber` is strictly unique.

---

### Tier 3: Cross-Feature Combinations (`tests/e2e/tier3-combinations.test.js`)
*Objective: Verify state transitions and data flows across multiple interacting subsystems.*

- **T3.1 — Auth + Active Event + Sales Creation Pipeline**:
  - Issue JWT -> Fetch active event for tenant -> Extract `eventId` -> Post POS sale -> Verify created sale reflects seller and tenant identity.
- **T3.2 — Catalog Sync + Search Pipeline**:
  - Verify synchronization contract -> Query web catalog search -> Assert returned structure maps to local product schema (with sizes and tags).
- **T3.3 — Storage Upload + Sale Receipt Attachment**:
  - Upload voucher buffer -> Receive storage URL -> Attach `receiptUrl` in sale payment -> Assert persisted sale contains attachment URL.
- **T3.4 — Sale Transaction + Real-Time Live KPI Impact**:
  - Read baseline event KPIs -> Record new sale with known amount (e.g. Q150) -> Re-fetch event KPIs -> Assert `totalAmount` and `totalTransactions` increment precisely.
- **T3.5 — Split Payment Multi-Tender Reconciliation**:
  - Record sale with dual tender (e.g. Q45 EFECTIVO + Q55 TARJETA = Q100) -> Verify both payment records persist and reconcile with total sale amount.

---

### Tier 4: Real-World Scenarios (`tests/e2e/tier4-scenarios.test.js`)
*Objective: Full day-in-the-life operational workflow for an exhibition booth.*

- **T4.1 — Complete Event Day Lifecycle Simulation**:
  1. **Booth Opening**: Cashier logs in, checks active event (`GET /api/events/active`) and confirms assigned booth.
  2. **Catalog Browsing**: Cashier looks up posters on demand (`GET /api/catalog/web-posters?q=Spider`).
  3. **High-Frequency Sales**:
     - Sale A: Standard cash sale (Poster Mini Q25).
     - Sale B: Card sale with discount (Poster Mediano Q65 - Q5 = Q60).
     - Sale C: Transfer sale with uploaded receipt proof.
  4. **Managerial Oversight**: Shift supervisor checks live monitor (`GET /api/sales/monitor`) and live event KPIs (`GET /api/sales/events/:eventId/metrics`).
  5. **Post-Sale Note Adjustment**: Cashier edits an existing sale with customer feedback (`PATCH /api/sales/:id`).
  6. **Shift Closing (Arqueo de Caja)**:
     - Cashier executes cash closing (`POST /api/closings`).
     - System computes theoretical cash vs physical cash, recording audited variance (`cashDifference`).
     - Cashier reviews audit history (`GET /api/closings/events/:eventId`).

---

## 4. Execution Protocol

### Requirements
- Node.js >= 20 (Node 22 LTS or Node 26 recommended)
- Operational database or development test instance

### Environment Variables
| Variable | Description | Default |
|---|---|---|
| `TEST_BASE_URL` | Base HTTP endpoint of the server | `http://localhost:3001` |
| `JWT_SECRET` | Secret key to issue test tokens | Read from `.env` |
| `NODE_ENV` | Environment identifier | `development` / `production` |

### Running the Tests
```bash
# Run the complete test suite (all 4 tiers) with the unified runner
node tests/e2e/run-all.js

# Run individual tiers with Node's native test runner
node --test tests/e2e/tier1-features.test.js
node --test tests/e2e/tier2-boundary.test.js
node --test tests/e2e/tier3-combinations.test.js
node --test tests/e2e/tier4-scenarios.test.js
```
