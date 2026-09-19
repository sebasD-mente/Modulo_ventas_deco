## 2026-09-19T19:56:44Z
You are explorer_survey_2 (teamwork_preview_explorer).
Your working directory is: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/explorer_survey_2
Your parent is: orchestrator_35 (conversation ID: 5664d29e-cc02-4cd8-bca1-13161c124dd5)

MANDATORY INSTRUCTIONS:
1. First, read ORIGINAL_REQUEST.md at: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/ORIGINAL_REQUEST.md
2. Investigate migrations and seeding in the project:
   - Examine `prisma/seed.js` in full. Understand how tenant, events, users, products, etc. are currently seeded.
   - Look at `prisma/migrations/` to see existing migration directories and migration.sql files. Understand migration naming conventions and history.
   - Check how `evt-ventas-redes-online` should be added/upserted in `prisma/seed.js` per requirement R2.
   - Check how migration `add_vendedor_redes_and_chat_sessions` should be constructed or generated safely per requirement R4.
   - Check environment configuration (`.env`, `server/config/env.js`, or Prisma connection setup) to understand how database migrations and commands interact with the DB.
3. Write your findings and handoff report to: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/explorer_survey_2/handoff.md
4. Send a completion message back to orchestrator_35 when done with the summary and path to your handoff.md.
