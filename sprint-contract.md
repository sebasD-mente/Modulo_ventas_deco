# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-001` Completada y Certificada `12/12 ACEPTAR`)
- **Tarea activa (`in-progress`):** Ninguna (`WIP = 0`; `feat-001` sellada en `done`).
- **Siguiente tarea secuencial:** Lista para registrar e iniciar `feat-002` bajo `WIP = 1` cuando el usuario solicite un nuevo entregable.

## Alcance Incluido (`Fair game`)
- **Purga e higiene de raíz (Fase 1)**: `git rm -rf .agents/library`, `git rm -f phase3_live_verified.png`, reubicación de las 84 capturas `.png` sueltas de la raíz hacia `test_evidence/root_archive/` (preservando intacto `test_evidence/prod_*.png`), movimiento con `git mv` de los 4 reportes históricos (`AUDITORIA_360_STAND_IA.md`, `VALKYRIA_FINAL_REPORT.md`, `PROMPTS_QUIRURGICOS_COTIZADOR_FRED.md`, `PROMPT_CIRUGIA_2_TALLER_WHATSAPP_FRED.md`) hacia `docs/exec-plans/completed/`, eliminación de `scratch/` local y fusión de `.gitignore` (incluyendo `!AGENTS.md` para anular `.git/info/exclude`) + `.gitattributes` (`text eol=lf` explícito en scripts y todos los artefactos `.md`/`.json` del arnés bajo `core.autocrlf=true`).
- **Instalación y adaptación Brownfield de los 28 artefactos (Fase 2)**: copia certificada con `0 CRLF` desde `Plantilla-Maestra-Arnes`, adaptación real de `ARCHITECTURE.md` (9 dominios + equivalencia de las 6 capas + puntos calientes + `LEGACY_SERVER_ALLOWLIST`), `docs/QUALITY_SCORE.md` y Sección 2 de `scripts/check-architecture.sh` (aislamiento Fullstack `src <-> server`, orden direccional en `src/` y orden direccional + prohibición de salto `controllers -> config` en `server/` salvo las 13 tuplas congeladas).
- **Unificación con candados Deko Labs y hooks nativos (Fase 3)**: integración en `init.sh` (`~8.8s` / `< 10s` offline en Windows Git Bash con `vite build` sobre `1,566` módulos), actualización de `scripts/audit-harness.js` (`STAND-IA-UNIFIED-HARNESS`), script `harness:validate` en `package.json`, sincronización de artefactos de estado (`feature_list.json`, `sprint-contract.md`, `progress.md`, `loop-state.md`, `session-handoff.md`) y activación final de `.agents/hooks.json`.

## Exclusiones Explícitas (Qué NO se va a tocar bajo ninguna circunstancia)
- **Cero lectura o impresión de `.env`** (contiene credenciales reales de producción).
- **Cero modificaciones en código e infraestructura de producción**: prohibido alterar ni una sola línea dentro de `src/`, `server/`, `prisma/`, `Dockerfile`, `docker-compose.yml`, `.dockerignore` o `entrypoint.sh`, y prohibido alterar `test_evidence/prod_*.png`.
- **Cero despliegue remoto**: prohibido ejecutar `git push` o `npm run deploy` (únicamente un `git commit` atómico local tras el veredicto `ACEPTAR` del Checker independiente).
- **Cero auto-calificación o reutilización de Checker**: el *Maker* tiene prohibido rellenar puntajes en `evaluator-rubric.md` o enviar `send_message` a un *Checker* ya consumido (`1 Checker = 1 sola auditoría / one-shot`).

## Estándares de Verificación ("Hecho" significa exactamente esto)
1. Los 28 artefactos del arnés existen físicamente en disco con `0 CRLF` (`AGENTS.md` en `100` líneas exactas y `scripts/harness-hooks.mjs` en `279 <= 280` líneas con bloqueo destructivo de Prisma activo).
2. `& "C:\Program Files\Git\bin\bash.exe" ./init.sh` termina con `Exit code 0` en `~8.8s` (`< 10s`, `100%` offline sin tocar `DATABASE_URL` remota) y `Overall: 100/100` (`25/25 PASS`).
3. `npm run harness:check` termina en `HARNESS_PASS` (`STAND-IA-UNIFIED-HARNESS`) con arquitectura, `validate-harness`, `audit-secrets`, `audit-syntax`, `verify-gemini-models`, `zero-trust`, `test:unit` y `vite build` en verde.
4. Una suite efímera en `os.tmpdir()` (`< 2s`, eliminada en `finally`) confirma el rechazo de un 14.º import ilegal en `check-architecture.sh`, el bloqueo de `prisma migrate reset` / `prisma db push --accept-data-loss` en `harness-hooks.mjs` y `0 CRLF` en los 28 artefactos, y una instancia *Checker* `one-shot` virgen (`zero-inheritance`) califica `evaluator-rubric.md` con `11-12 / 12` (`ACEPTAR`).
