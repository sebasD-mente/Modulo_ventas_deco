# DISPATCH LOG

## 2026-09-09T14:22:16Z
From: parent (55ff2474-bfa9-4d72-a97c-226e85e19922)
To: orchestrator_1 (40958512-4854-45d9-bf41-45feacb902c8)

Mission & Scope:
Implementar y auditar de forma quirúrgica la arquitectura de producción de Deko EventSales, erradicando la deuda técnica acumulada, blindando la seguridad, garantizando el aislamiento estricto de base de datos e infraestructura, y preparando el despliegue inmutable en Dokploy con Google Cloud Storage.

Requirements:
- R1: Dead code removal (delete 7 orphan components: AiChatAssistant.jsx, BatchPhotoScanner.jsx, QuickPosKeyboard.jsx, LiveMonitor.jsx, CatalogView.jsx, VoiceRecorder.jsx, HumanVerificationModal.jsx). Audit imports across src/ to ensure zero broken references. Verify npm run build exits 0.
- R2: API security & sales concurrency. Fix server/middleware/authMiddleware.js (remove || !authHeader to enforce valid Bearer token in production). Refactor server/services/saleService.js for atomic, race-condition-resistant sale number generation (generateSaleNumber). Parameterize SQL query in server/services/webCatalogService.js.
- R3: Version control & Git. Create strict .gitignore. Initialize git init, write technical README.md, commit initial semantic commit.
- R4: GCS permanent storage. Provision bucket gs://deko-eventsales-media/ in us-central1 on GCP project tienda-deco-vintage-web. Set up Service Account with roles/storage.objectAdmin and secure credentials. Refactor server/services/gcsStorageService.js to eradicate ephemeral local disk fallback.
- R5: Strict database isolation & decoupled sync. Dedicated DB deko_eventsales_db. Implement catalogSyncService.js consuming public API GET /api/catalog/posters.
- R6: Production multi-stage Docker. Professional multi-stage Dockerfile based on node:22-bookworm-slim, executable entrypoint.sh checking PostgreSQL connectivity & running Prisma migrations/push, strict .dockerignore.
