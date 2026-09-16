# BRIEFING — 2026-09-16T01:32:28Z

## Mission
Implementación atómica y blindada de la Fase 3 del Roadmap Quirúrgico Cero Deuda (P1) en Modulo_Ventas, restituyendo el flujo completo de bucle cerrado SSE (Turno 2) en aiStreamService.js, eliminando textos duplicados frente a ChatDraftCard, modularizando la tarjeta de borrador con DraftItemRow.jsx para cumplir los techos de líneas (<140 líneas), previniendo cierres obsoletos (stale closures) con pendingDraftRef y garantizando áreas táctiles feriales WCAG 2.1 AAA (>= 44px).

## 🔒 My Identity
- Archetype: sentinel
- Working directory: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/sentinel
- Orchestrator (Phase 1 Fixes): c9b31c4e-2a28-49d5-bb78-e8c2bffdfd7c (completed)
- Victory Auditor (Phase 1 Fixes): cdcacae0-a987-4747-b517-31685a840676 (VICTORY CONFIRMED)
- Orchestrator (Phase 2): 5a4ca9da-f208-4b77-9f56-561dbd3809fc (completed)
- Victory Auditor (Phase 2): f707bc62-ed20-4c3e-8142-e20f90e17f95 (VICTORY CONFIRMED)
- Orchestrator (Auditoría 360): 90425077-fad3-4f25-aaeb-7fd30a0e5a41 (completed)
- Victory Auditor (Auditoría 360): bb28db25-f78e-43ea-ae28-677d87415619 (VICTORY CONFIRMED)
- Orchestrator (Modernización STAND IA): 4f9147ba-7ab0-47c4-ba7b-7275197efacc (completed)
- Victory Auditor (Modernización STAND IA): 0815f5ed-bfbc-450f-8240-790e8aca73df (VICTORY CONFIRMED)
- Orchestrator (Cirugía Modular aiMultimodalService): e10a6ac6-c756-4f75-b83b-4e5bad61d322 (completed, orchestrator_7)
- Victory Auditor (Cirugía Modular aiMultimodalService): 5f048d08-8f81-426b-a2d5-455b57d00f68 (VICTORY CONFIRMED, victory_auditor_7)
- Orchestrator (Modular Refactor UnifiedAiChat): 77de464d-cbe1-4d4d-b079-fc3688d9c5ea (completed, orchestrator_8)
- Victory Auditor (Modular Refactor UnifiedAiChat): 38786f75-8cd6-4fd8-a321-0adeffbf37c6 (VICTORY CONFIRMED, victory_auditor_8)
- Orchestrator (Phase 3 Refactor EventsManagementView): 3984481d-f6d5-430f-bedd-75ffd00ba8cc (completed, orchestrator_9)
- Victory Auditor (Phase 3 Refactor EventsManagementView): 6e585cc2-da6c-4933-aa73-5809a145318e (VICTORY CONFIRMED, victory_auditor_9)
- Orchestrator (Phase 4 Refactor FastManualSaleForm): 4d97b55b-72a3-487c-9bda-b690b26eba80 (completed, orchestrator_10)
- Victory Auditor (Phase 4 Refactor FastManualSaleForm): b7ba2c28-d8ed-488e-b333-2f13ce8b060b (VICTORY CONFIRMED, victory_auditor_10)
- Orchestrator (Phase 5 Frontend Monolith Eradication): e47969bc-381d-4146-86fc-9a0d0cc8343f (orchestrator_11, completed)
- Victory Auditor (Phase 5 Frontend Monolith Eradication): cd632a21-d029-4a56-a93d-a33db2a48362 (victory_auditor_11, VICTORY CONFIRMED)
- Orchestrator (Auditoría Forense 360 STAND IA): e1b926ca-db1d-45ad-9385-7a7a940f1c72 (orchestrator_12, completed)
- Victory Auditor (Auditoría Forense 360 STAND IA): 21069150-5191-410b-b878-407fe086fb8a (victory_auditor_12, VICTORY CONFIRMED)
- Orchestrator (Fase 1 Estabilización STAND IA): orchestrator_13 (superseded)
- Orchestrator (REHACER Fase 1 Conexión Viva STAND IA): f7ea2546-0c7d-497d-97e8-791a3e75db08 (orchestrator_14, completed in production 1d41cec)
- Victory Auditor (REHACER Fase 1 Conexión Viva STAND IA): f6209258-5422-4373-8009-9c2dcf932823 (victory_auditor_sentinel_14, closed)
- Orchestrator (FASE 2 Closed-Loop STAND IA): 3098e265-0f6c-4aa8-8742-949cf2bf333c (orchestrator_15, completed)
- Victory Auditor (FASE 2 Closed-Loop STAND IA): 4d8c7534-6abd-4e0a-9a54-076dbf70b380 (victory_auditor_sentinel_15, VICTORY CONFIRMED)
- Orchestrator (Modernización Gen 3 & Resiliencia): 8032eb16-445b-4b60-9d2c-03db10d5b529 (orchestrator_16, M1 completed, succeeded)
- Orchestrator Successor: orchestrator_17 (completed M2, M3, M4)
- Victory Auditor (Modernización Gen 3 & Resiliencia): 15479362-8856-47fd-8842-f53a371c3b40 (victory_auditor_sentinel_16, VICTORY CONFIRMED)
- Orchestrator (Auditoría Forense 360 & Blueprint STAND IA): 44270e0b-1540-4a69-abea-7df48f0385e2 (orchestrator_18, completed)
- Victory Auditor (Auditoría Forense 360 & Blueprint STAND IA): 74d11d9a-455c-4c21-a28d-37e837e7f261 (victory_auditor_18, VICTORY CONFIRMED)
- Orchestrator (Cirugía Arquitectónica & Blindaje P0): orchestrator_19 (completed)
- Victory Auditor (Cirugía Arquitectónica & Blindaje P0): closed
- Orchestrator (RAG Vectorial & Copiloto STAND IA): 6ddcf51f-f397-4dd4-ad16-5a76fa7c9097 (orchestrator_20, completed)
- Victory Auditor (RAG Vectorial & Copiloto STAND IA): 3db69a7d-e74e-42f6-904e-1c5ce91f58fd (VICTORY CONFIRMED, victory_auditor_20)
- Orchestrator (Calibración Cognitiva & RAG Real STAND IA): 49bacfc9-111d-49c6-a56b-a5b485ca6767 (orchestrator_21, completed)
- Victory Auditor (Calibración Cognitiva & RAG Real STAND IA): completed
- Orchestrator (Auditoría Forense 360 Fred): 5045eebf-d54f-4d6a-895b-7a1f7cda50b3 (orchestrator_22, completed)
- Victory Auditor (Auditoría Forense 360 Fred): 3f656233-98ac-4499-947e-88202dcd40fc (victory_auditor_22, VICTORY CONFIRMED)
- Orchestrator (Fase 1 Roadmap Quirúrgico): 6408c0c3-26fa-4769-a9aa-efe396dfb647 (orchestrator_23, completed)
- Victory Auditor (Fase 1 Roadmap Quirúrgico): d2fb8311-9b34-4961-915e-f6d594ad405a (victory_auditor_23, VICTORY CONFIRMED)
- Orchestrator (Fase 2 Roadmap Quirúrgico): db233a73-dd6b-4945-8057-cdd1e9a20608 (orchestrator_24, completed)
- Victory Auditor (Fase 2 Roadmap Quirúrgico): c355957c-7feb-4d66-b52d-fcb1a7fd6e6c (victory_auditor_24, VICTORY CONFIRMED)
- Orchestrator (Fase 3 Roadmap Quirúrgico): fc099ae9-9a32-4092-80b2-44e5faf0a199 (orchestrator_25, running)
- Victory Auditor (Fase 3 Roadmap Quirúrgico): TBD (to be spawned on victory claim)

## 🔒 Key Constraints
- No technical decisions — relay only
- Victory Audit is MANDATORY before reporting completion
- Live browser verification with Chrome DevTools MCP & visual evidence screenshots before claiming completion (<RULE[user_global]>)
- Strict database and infrastructure isolation per aislamiento-estricto-proyectos (100% en deko_eventsales_db)
- Zero-Trust credentials protocol: no reuse of unauthorized credentials
- 100% of codebase files (.js, .jsx, .json, .prisma, .sh, Dockerfile) audited with exact file:///...#Lxx references
- No theoretical assumptions; backed by inspected code
- Strict compliance with Phase 5 Roadmap: R1 to R5 decomposition, quality harness, live verification
- Canon containers strictly < 70 lines; submodules < 140 lines; no file > 200 lines
- Monolith inventory reduction from 15 to <= 10 files (0 frontend monoliths remaining)
- Zero breaking changes to src/App.jsx and public props contracts
- Pure inspection mode: strictly forbidden to patch or alter production source code during this forensic audit
- 100% coverage of IA subsystem across frontend and backend with exact file:///...#Lxx line references
- Zero mocks, zero hallucinations: all defects must be verified directly in code or via empirical scratch/ tests
- Master report published at c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/orchestrator_12/AUDIT_REPORT_STAND_IA.md
- Cero tolerancia a respuestas de buildOfflineFallbackReply en pruebas de IA: la IA debe responder en vivo desde Gemini.
- Cero mutación de mensajes de usuario y cero colisiones de ID en el chat.
- FASE 2 Line limits: aiStreamService < 150, aiToolsService < 200, useAiChatStream < 160, ChatToolCards < 140 lines
- Closed-loop function calling with continuous dual streaming (eradicate hasTextTokens)
- Multi-turn conversational memory (20 turns) with chain-of-thought draft editing
- Eradicate N+1 queries in seller shift report via aiShiftReportService
- UI cleanup for inventory stock and zero orphan empty containers
- FASE 3 Modernización Gen 3: aiKeyPoolService < 120, geminiPoolService <= 334, aiClosedLoopService < 120, aiStreamService < 150, aiToolsService < 140, useAiChatStream < 160, ChatToolCards < 140, catalogCacheService < 90, useAiChatAudio < 60
- Master report published at AUDITORIA_360_STAND_IA.md in repository root
- Zero code bloat added to audited files; npm run harness:check must pass 100%
- REGLA SAGRADA ANTI-FILE SPRAWL: Prohibido despiezar o tocar los 7 archivos medianos (~250-300 líneas: userController.js, authController.js, catalogController.js, geminiPoolService.js, catalogSyncService.js, etc.).
- Despiece quirúrgico exclusivo en los 3 Monolitos Peligrosos: saleService.js (< 35 líneas fachada), semanticParserService.js (< 30 líneas fachada), productionController.js (erradicación demoProductionItems, lógica en productionService.js).
- P0 Blindaje de feria: catalogCacheService Map acumulativo hasta 300 obras; deko_auth_user en localStorage para persistencia offline; useAiVoiceRecorder 7s timeout y calibración 400ms; aiMediaService con executeWithModelFallback; requireEventAccess en PATCH /sales/:id y tenantId en userController; protección de /health/ai.
- Higiene: npm uninstall bcryptjs qrcode; eliminar COPY .git de Dockerfile; migraciones formales en prisma/migrations.
- Calidad 4/4: test:security, audit:secrets, npm test, npm run build limpios.
- RAG Vectorial Híbrido en RAM: embeddingService.js < 150 líneas, text-embedding-004 / gemini-embedding-001, similitud coseno sub-15ms, MIN_SIMILARITY_THRESHOLD = 0.45 estricto sin falsos positivos irrelevantes.
- Purga completa de textos enlatados ("tintas látex", "cintas tesa", "volumen alto de consultas").
- Calibración de personalidad de mostrador: copiloto táctico de vendedor, rápido, enérgico, combos de feria (2xQ120, 3xQ180).
- Verificación en vivo obligatoria con Chrome DevTools MCP y capturas de alta resolución.
- Modelo de embeddings gemini-embedding-001 (3072 dims), MIN_SIMILARITY_THRESHOLD = 0.45.
- Preservar candidates[0].content.parts originales (thoughtSignature) y formatear functionResponse con rol user en @google/genai.
- Erradicar banner "⚠️ Conexión con IA intermitente...".
- Cero contaminación cruzada en catálogo (F1 solo automovilismo, el bicho solo CR7, saiyajin solo Goku/Dragon Ball).
- Asistente nerd, formal, inteligente, respuestas en 1-3 líneas con Gemini 3.8 Flash, sugerencia de combos de feria (2xQ120, 3xQ180).
- Repetición exhaustiva de pruebas 1, 2 y 3 en vivo en Chrome DevTools MCP con evidencia visual de alta resolución.
- Reporte técnico y hoja de ruta arquitectónica para Comic Con 2026.
- Auditoría forense 360° y diagnóstico exhaustivo de causa raíz 100% respaldado en código real con archivo y líneas exactas (Cero Suposiciones).
- Despliegue y coordinación del Squad Especialista de Subagentes de Fred (4 Sabuesos: Búsqueda/RAG, Orquestador Conversacional, Monolitos/Estado, Resiliencia/DB).
- Entrega del Informe Maestro Final de Fred estrictamente estructurado en las 5 secciones obligatorias de R5.
- Fase 1 Roadmap Quirúrgico Cero Deuda (P0): R1 PostgreSQL secuencias nativas sin tx.event.update, R2 erradicación mocks aiMediaService y resiliencia UI con botón "Cargar Manual", R3 idempotencia real RFC 7231 con idempotencyKey @unique y replay HTTP 200.
- Fase 2 Roadmap Quirúrgico Cero Deuda (P0): R1 Stop-words universales (50+) y entidades cortas ("f1", "cr7", KNOWN_SHORT_ENTITIES), R2 Calibración vectorial >= 0.72 y compuerta de entidad raíz con every, R3 AbortController en useCatalogSearch y snapshot asíncrono con TIMEOUT_MS 1500ms en catalogCacheService, R4 Techos de líneas estrictos (embeddingService <= 200, useCatalogSearch <= 200, catalogCacheService <= 200, entityAliases <= 600).
- Fase 3 Roadmap Quirúrgico Cero Deuda (P1): R1 Bucle cerrado SSE Turno 2 en aiStreamService (eliminar if (hasDraft) return), directivas de prompt concisas (1-2 líneas vendedoras sin recitar catálogo duplicado) en aiPromptService, purga parámetro muerto en aiToolsService; R2 Modularización con DraftItemRow.jsx, ChatDraftCard < 140 líneas, useAiChatStream con pendingDraftRef erradicando stale closures (< 160 líneas); R3 Áreas táctiles mostrador ferial WCAG 2.1 AAA (>= 44px controles +/-, botones pago y ChatToolCards, >= 48px confirmar venta); R4 Techos de líneas estrictos (ChatDraftCard < 140, useAiChatStream < 160, ChatToolCards < 140, ChatSwapModal < 100, aiStreamService <= 200, aiClosedLoopService <= 200).

## User Context
- **Last user request**: Implementación atómica y blindada de la Fase 3 del Roadmap Quirúrgico Cero Deuda (P1) en el repositorio Modulo_Ventas (R1 Restitución bucle cerrado SSE Turno 2 y retiro texto duplicado, R2 Modularización DraftItemRow.jsx, line ceilings y erradicación stale closures con pendingDraftRef, R3 Rediseño zonas táctiles mostrador ferial >= 44px, R4 Techos de líneas y calidad de código).
- **Pending clarifications**: none
- **Delivered results**: Fase 2 certificada. Fase 3 iniciando ejecución.

## Project Status
- **Phase**: in progress
- **Route**: General (`teamwork_preview_orchestrator`)
- **Active Orchestrator**: orchestrator_25 (fc099ae9-9a32-4092-80b2-44e5faf0a199, running)
- **Active Auditor**: TBD (to be spawned on victory claim)
- **Monitoring Crons**: task-46 (Cron 1 Progress: */8 * * * *), task-48 (Cron 2 Liveness: */10 * * * *)

## Victory Audit Status
- **Triggered**: no
- **Verdict**: pending
- **Retry count**: 0

## Artifact Index
- c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/ORIGINAL_REQUEST.md — Authoritative verbatim user request
- c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/sentinel/BRIEFING.md — Sentinel persistent memory
- c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/sentinel/handoff.md — Sentinel master handoff
- c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/AUDITORIA_360_STAND_IA.md — Reference specification (Sección 5: Fase 3)
- c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/orchestrator_25/ — Orchestrator Fase 3 workspace


