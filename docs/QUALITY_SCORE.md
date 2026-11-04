# QUALITY_SCORE.md (Mapa de Salud, Estabilidad y Evolución del Sistema — `deko-eventsales`)

Este documento proporciona **Observabilidad de Proceso a Largo Plazo** sobre **STAND {IA} (`deko-eventsales`)**. Mientras `evaluator-rubric.md` responde *"¿Hizo buen trabajo el agente en esta sesión?"*, `docs/QUALITY_SCORE.md` responde *"¿El repositorio se está fortaleciendo o debilitando con el tiempo?"*, permitiendo que cualquier sesión nueva identifique de inmediato qué dominios o capas son sólidos (`A`) y cuáles presentan deuda técnica acotada (`B`, `C` o `D`).

**Cadencia de Actualización:**
- Después de cada sesión o entrega significativa.
- Antes y después de ejecutar comparaciones de benchmark o estudios de ablación.
- Después de reducir deuda heredada (como tuplas en `LEGACY_SERVER_ALLOWLIST` o módulos duplicados latentes).
- Al incorporar un nuevo agente, herramienta o modelo Gemini al flujo de trabajo.

**Escala de Calificación:**
- **A**: Toda la verificación pasando, límites arquitectónicos impuestos mecánicamente, legible para el agente y tests estables.
- **B**: Funcionando correctamente en producción con deuda estructural acotada/congelada o brechas menores de consolidación.
- **C**: Parcialmente funcional, difícil de entender para el agente o con inestabilidad notable en tests (*flaky*).
- **D**: Roto, inseguro o estructuralmente confuso (prioridad máxima de reparación antes de expandir alcance).

---

## 1. Dominios del Proyecto (`STAND {IA}` / `deko-eventsales`)

| Dominio / Área | Calificación (A-D) | Verificación | Legibilidad para el Agente | Estabilidad de Tests | Brechas Principales | Última Actualización |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **1. Auth Multi-Tenant y Roles (`auth`)** | A | `tests/security/zero-trust.test.js` (`PASS`) | Alta (`AuthContext.jsx`, `authService.js`, `userService.js`, `authController.js`, `userController.js`) | Estable | Ninguna crítica (`0` tuplas heredadas tras `feat-002`; `invalidateUserAuthCache` preservado en `userController.js`) | 2026-11-04 |
| **2. Eventos Feriales y Gastos (`events`)** | B | Suite adversarial multi-evento (`surgery-053`, `surgery-065`) en `npm run test:unit` | Media-Alta (`eventFinanceService.js` limpio; `eventController.js` extenso) | Estable | `eventController.js` es punto caliente de tamaño y conserva 2 tuplas heredadas hacia `config/` | 2026-11-03 |
| **3. Catálogo de Pósters y Sync Web (`catalog`)** | A | Suites `deduplication`, `fuzzy-typo-tolerance`, `phase-3`, `tags-search` (`PASS`) | Alta (`catalogCacheService.js`, `catalogSyncService.js` y `server/services/catalog/`) | Estable | `0` tuplas heredadas tras `feat-001` y `feat-002`; persiste duplicado latente `webCatalogService.js` documentado en `ARCHITECTURE.md` | 2026-11-04 |
| **4. POS Mostrador y Cola Offline (`pos`)** | A | Suites `idempotency`, `sale-sequences`, `phase6-combos-offline-accelerators` (`PASS`) | Alta (`FastManualSaleForm.jsx`, `offlineSalesOutbox.js`, `server/services/sales/`) | Estable | `saleController.js` conserva 1 acceso directo heredado a `config/prisma.js` en allowlist | 2026-11-03 |
| **5. Ventas Redes / Cotizador 50-50 / Logística (`remote-sales`)** | A | Suites `surgery-056`, `surgery-061`, `surgery-064` (`PASS`) | Media-Alta (`remoteSaleService.js` bien aislado en capa `Service`) | Estable | `remoteSaleService.js` es módulo denso; mantener cobertura al tocar reglas 50/50 | 2026-11-03 |
| **6. Asistente Multimodal STAND {IA} (`ai-copilot`)** | A | `verify-gemini-models.js` + `surgery-066-voice-catalog-search` + `npm run test:voice` | Alta (`UnifiedAiChat.jsx`, `server/services/{ai,semantic}/`) | Estable | `entityAliases.js` extenso (`0` tuplas heredadas en capa IA y `Config` tras `feat-001`) | 2026-11-04 |
| **7. Taller y Pliegos de Impresión (`production`)** | A | Validación de esquema, sintaxis (`audit-syntax.js`) y contratos integrados | Alta (`productionService.js`, `printSheetService.js` sin violaciones de capa) | Estable | Ampliar pruebas unitarias dedicadas de armado de pliegos cuando se modifique el módulo | 2026-11-03 |
| **8. Cierre de Caja y Monitor Financiero (`finance-closing`)** | A | `surgery-058-accounting-transparency-and-breakdown.test.js` (`PASS`) | Alta (`cashClosingService.js`, `midnightClosingService.js`, `monitorKpiService.js`) | Estable | Ninguna crítica (`0` tuplas heredadas tras `feat-002`) | 2026-11-04 |
| **9. Liquidaciones y Comisiones 20% neto (`commissions`)** | A | Contratos contables y validación sintáctica/unitaria (`PASS`) | Alta (`commissionService.js` encapsulado en capa `Service`) | Estable | Ninguna crítica | 2026-11-03 |
| **Gobernanza, Seguridad y Verificación Unificada (`harness`)** | A | `init.sh` (`100/100`, `25/25 PASS`) + `npm run harness:check` (`STAND-IA-UNIFIED-HARNESS`) | Alta (`AGENTS.md` en `100L`, `ARCHITECTURE.md`, `hooks.json` + `harness-hooks.mjs <= 280L` con candado Prisma) | Estable (`100%` determinista y `100%` offline) | Ninguna | 2026-11-03 |

---

## 2. Capas Arquitectónicas (`Types -> Config -> Repo -> Service -> Runtime -> UI`)

| Capa | Calificación (A-D) | Enforcement de Límites | Legibilidad para el Agente | Brechas Principales | Última Actualización |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Definiciones (`Types`: `prisma/schema.prisma`, `server/validators/`)** | A | Vigilado por `scripts/check-architecture.sh` + `tests/schema/schema-robustness.test.js` | Alta (`validators (1)` sin dependencias hacia capas superiores y `feature-list.schema.json`) | Ninguna | 2026-11-03 |
| **Ajustes (`Config`: `server/config/`, `vite.config.js`)** | A | Vigilado por `scripts/check-architecture.sh` + `audit-secrets.js` + `verify-gemini-models.js` | Alta (validación Zod en `env.js`, rotación `geminiKeyPool.js` y candados `.gitignore` / `PreToolUse`) | Ninguna (`0` dependencias hacia capas superiores tras `feat-001`) | 2026-11-04 |
| **Datos y Lógica (`Repo` / `Service`: `server/services/`, `src/utils/`, `src/services/`)** | A | Vigilado direccionalmente en `src/` (`utils -> services`) y `server/` (`services` aislado de `controllers`/`routes`), `0` cruces `src <-> server` | Alta (lógica de dominio y `scripts/lib/harness-utils.mjs` sin `process.exit`) | Duplicados latentes heredados (`webCatalogService.js` y `imageCompression.js` / `imageCompressor.js`) documentados en `ARCHITECTURE.md` | 2026-11-03 |
| **Ejecución Backend (`Runtime`: `server/{middleware,controllers,routes,index.js}`)** | B | Vigilado por `scripts/check-architecture.sh` con `LEGACY_SERVER_ALLOWLIST` congelada (cualquier 4.º salto falla con Bolígrafo Rojo) | Media-Alta (flujo claro `middleware -> controllers -> routes -> index.js`) | 3 accesos directos heredados `Controller -> Config` (`eventController` y `saleController`) congelados en allowlist para cierre final en `feat-003` (`13 -> 9 -> 3` tras `feat-002`) | 2026-11-04 |
| **Ejecución Frontend y Arnés (`Runtime`: `src/{hooks,context}`, `init.sh`, `scripts/*.mjs`)** | A | `0` violaciones en `src/hooks -> src/context`; 3 Puertas POSIX + hooks `Fail-Closed` `<= 280L` | Alta (`init.sh` `~8.8s` / `< 10s` offline con `vite build` y `audit-harness.js` unificado) | Ninguna | 2026-11-03 |
| **Salida / Interfaz (`UI`: `src/components/`, `src/{App,main}.jsx`)** | A | `0` violaciones direccionales en `src/` (`components -> App.jsx / main.jsx`) y compilación limpia `vite build` | Alta (componentes desacoplados de `server/` con `0` imports cruzados) | `src/App.jsx` concentra ruteo de vistas principales (punto caliente monitoreado) | 2026-11-03 |

---

## 3. Instantáneas de Benchmark y Registro de Simplificación (Estudios de Ablación)

Las instantáneas de benchmark y los estudios de ablación operan como un único ciclo empírico: se toma una instantánea de línea base (`3.1`), se pone a prueba o simplifica un componente en aislamiento y se registra la evidencia y la decisión (`Mantener` o `Eliminar`) en la tabla de ablación (`3.2`), manteniendo sincronizada esta **Sección 3** con el protocolo de `docs/GOTCHAS.md`.

### 3.1 Instantáneas de Benchmark (`Benchmark Snapshots`)

| Fecha | Variante del Harness | Tasa de Completitud | Reintentos | Defectos Antes de Revisión | Notas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-11-03 | `legacy-harness2` (pre-migración en `deko-eventsales`) | Parcial (`6` pasos Deko sin validación `100/100`, sin linter dual de capas ni hooks `Fail-Closed`) | `0` | `85` PNG sueltas y `4` reportes históricos en raíz + `13` acoplamientos heredados sin congelar | Reemplazado por purga limpia `.agents/library` e higiene de raíz |
| 2026-11-03 | `stand-ia-unified-r2` (`feat-001` Brownfield certificado) | `100%` en Puertas 1-3 (`25/25 PASS`, `init.sh` `~8.8s` / `< 10s` offline) + `HARNESS_PASS` completo en `npm run harness:check` | `1` ajuste (`Round 1 -> Round 2`) | `3` hallazgos capturados por Checker `one-shot` en Ronda 1 (`!AGENTS.md` sobre `.git/info/exclude`, `eol=lf` en `.gitattributes` y cota empírica `~8.8s`) cerrados antes del commit | Unificación de `Plantilla-Maestra-Arnes` con candados físicos Deko Labs (`audit-secrets`, `audit-syntax`, `verify-gemini-models`, `zero-trust`, `test:unit`, `vite build`) y candado Prisma destructivo |

### 3.2 Registro de Simplificación del Arnés (Estudios de Ablación)

> **Propósito**: Cada componente del arnés codifica un supuesto sobre lo que el modelo aún no garantiza por sí solo. Para verificar periódicamente si una restricción sigue aportando valor: (1) toma una instantánea de este documento (`3.1`), (2) desactiva temporalmente un único componente en un entorno aislado, (3) ejecuta el benchmark, (4) toma otra instantánea y (5) compara y registra aquí la decisión (`docs/GOTCHAS.md`).

| Fecha | Componente / Regla Puesta a Prueba | Comando / Experimento de Ablación Ejecutado | Resultado Empírico al Quitarlo / Violarlo | Decisión Final |
| :--- | :--- | :--- | :--- | :--- |
| 2026-11-03 | Linter dual `src/` + `server/` y `LEGACY_SERVER_ALLOWLIST` (`scripts/check-architecture.sh`) | Inyección sintética en `os.tmpdir()` de un 14.º import ilegal (`src -> server`, `src/utils -> src/components` y `productionController -> config/prisma`) | Rechaza los 3 casos con `Exit code 1` y formato Bolígrafo Rojo (`degraded` sin el candado) | **Mantener** |
| 2026-11-03 | Candado `PreToolUse` anti-Prisma destructivo (`scripts/harness-hooks.mjs`) | Evaluación en memoria de `prisma migrate reset` y `prisma db push --accept-data-loss` | Bloquea ambos con `decision: "deny"` protegiendo PostgreSQL remoto (`degraded` sin el candado) | **Mantener** |
| 2026-11-03 | Compuerta `Pass-State Gating` y `WIP <= 1` (`scripts/lib/harness-utils.mjs`) | Validación de `feature_list.json` con `node scripts/validate-harness.mjs --min-score 100` | Impide cerrar tareas sin `evidence` o sin `required_files` reales en disco (`degraded` sin el candado) | **Mantener** |
| 2026-11-03 | Detector de huérfanos en `memory/topics/` y enlaces muertos en `AGENTS.md` | Ejecución de `bash scripts/check-architecture.sh` (Secciones 3 y 4) | Garantiza `0` archivos de memoria huérfanos y `24/24` artefactos requeridos presentes (`degraded` sin el candado) | **Mantener** |
