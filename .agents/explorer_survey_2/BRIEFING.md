# BRIEFING — 2026-09-19T20:02:00Z

## Mission
Investigate migrations, database seeding, environment configuration, and safe schema evolution for VENDEDOR_REDES, ChatSession, and evt-ventas-redes-online.

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: Explorer, Investigator, Synthesizer
- Working directory: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/explorer_survey_2
- Original parent: 5664d29e-cc02-4cd8-bca1-13161c124dd5
- Milestone: Survey & Migration/Seeding Analysis

## 🔒 Key Constraints
- Read-only investigation — do NOT implement code changes in production/src/prisma code directly.
- All proposals must be documented in handoff report.
- Zero-trust security & zero assumptions.
- Maintain isolation between projects and databases.
- Follow AGENTS.md quality gate guidelines.

## Current Parent
- Conversation ID: 5664d29e-cc02-4cd8-bca1-13161c124dd5
- Updated: 2026-09-19T20:02:00Z

## Investigation State
- **Explored paths**:
  - `prisma/seed.js`: verified seed operations, lack of events, and where `evt-ventas-redes-online` upsert belongs.
  - `prisma/migrations/`: examined `20260913000000_init_stand_ia`, `20260915210000_add_sale_idempotency_key`, and `migration_lock.toml`.
  - `prisma/schema.prisma`: audited models, noted `AiChatSession` presence and redundant `@@index([sessionId])`.
  - `entrypoint.sh` & `Dockerfile`: discovered container startup migration flow (`prisma migrate deploy` -> `SKIP_WEB_SYNC=true node prisma/seed.js`).
  - `tests/schema/schema-robustness.test.js`: reproduced failing test on duplicate index `ai_chat_sessions:"sessionId"`.
  - `.agents/explorer_survey_2/check_indexes.js`: validated that eliminating `@@index([sessionId])` produces 45 clean indexes with 0 collisions.
  - `.agents/explorer_survey_2/proposed_migration.sql`: generated 167-line clean PostgreSQL DDL via `prisma migrate diff`.
  - `.agents/explorer_survey_2/proposed_test.js`: verified Node test runner execution with all 7 invariant tests passing (100% green).
  - `server/controllers/eventController.js`: found that `activateEvent` unsets active status of other events; `evt-ventas-redes-online` should be protected from deactivation.

- **Key findings**:
  1. `AiChatSession` in `prisma/schema.prisma` currently triggers a duplicate index error in `tests/schema/schema-robustness.test.js` because `sessionId` has both `@unique` and `@@index([sessionId])`. Removing `@@index([sessionId])` fixes the test and eliminates redundant indexing in PostgreSQL.
  2. In local dev, `DATABASE_URL` points to `host-db-dokploy:5432` which is not network-routable from Windows host. Running `prisma migrate dev` fails without DB. However, `prisma migrate diff --from-schema-datamodel ... --to-schema-datamodel ... --script` generates the exact PostgreSQL DDL 100% offline.
  3. `entrypoint.sh` executes `npx prisma migrate deploy` on every container deployment, which will seamlessly apply `20260919200000_add_vendedor_redes_and_chat_sessions/migration.sql`.
  4. Adding `evt-ventas-redes-online` in `prisma/seed.js` satisfies R2 and runs automatically via `entrypoint.sh` without requiring web sync.

- **Unexplored areas**: None for survey 2 scope. All assigned investigation questions answered empirically.

## Key Decisions Made
- Validated offline DDL generation pipeline using `prisma migrate diff`.
- Verified in-memory SQLite testing pattern for business invariants without external DB dependencies.
- Verified test suite design for R3 with 100% passing results.

## Artifact Index
- `.agents/explorer_survey_2/DISPATCH.md` — Incoming task dispatch record
- `.agents/explorer_survey_2/BRIEFING.md` — Persistent working memory
- `.agents/explorer_survey_2/progress.md` — Liveness heartbeat and milestone tracking
- `.agents/explorer_survey_2/proposed_schema.prisma` — Validated target Prisma schema
- `.agents/explorer_survey_2/baseline_schema.prisma` — Baseline schema for diffing
- `.agents/explorer_survey_2/proposed_migration.sql` — Generated 167-line SQL migration
- `.agents/explorer_survey_2/check_indexes.js` — Index collision audit script
- `.agents/explorer_survey_2/proposed_test.js` — Validated R3 test suite
- `.agents/explorer_survey_2/handoff.md` — Comprehensive handoff report
