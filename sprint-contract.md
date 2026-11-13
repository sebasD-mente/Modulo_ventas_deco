# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-008` Completada y Verificada)
- **Estado de sesión:** Tarea `feat-008` concluida bajo `Modo Diario Ágil` (`WIP = 0`).
- **Última tarea completada:** `feat-008` — Detección de cambios en tamaños (`sizes`) durante la sincronización del catálogo web.
- **Próxima tarea a ejecutar en DAG (`WIP = 1`):** Ninguna (`feat-000..008` cerradas en `done`).
- **Marcha de trabajo acordada:** `Modo Diario Ágil`.

---

## Alcance Ejecutado (`Scope` de `feat-008` — COMPLETADO)
1. **`server/services/catalog/liveCatalogSyncService.js`**:
   - Extraído helper puro compartido (`normalizeSizesSignature` / `hasCatalogProductChanged`) para comparar de forma determinista `prev` contra `data`, incluyendo `sizes`.
   - Incluido `sizes: true` en el `select` de `prisma.product.findMany` tanto en `deltaSyncRecentPosters` como en `syncCatalogFromWeb`.
   - Garantizado que cualquier alta, baja o cambio de precio/nombre/dimensiones en `sizes` (incluso cuando `basePrice` mínimo no cambia, ej. agregar Pequeño Q35 a un póster que ya tenía Mini Q25) marque `changed = true`, ejecute el `upsert` e invalide `invalidateCatalogCache` e `invalidateVectorCache`.
2. **`tests/catalog/catalog-sync-sizes.test.js`**:
   - Añadidas 3 pruebas unitarias verificando `hasCatalogProductChanged` y la selección de `sizes: true` en `syncCatalogFromWeb` y `deltaSyncRecentPosters`.

---

## Exclusiones Explícitas (`Hands off` cumplidas al 100%)
- **Cero lectura o modificación de `.env`** y **cero modificaciones en `prisma/schema.prisma`**.
- **Cero alteración de módulos ajenos** (ventas, eventos, monitor, auth, voz).
- **Cero debilitamiento de suites de prueba** existentes.
- **Cero nuevas dependencias NPM** y **cero despliegue remoto (`git push` / `npm run deploy`)**.

---

## Criterios Verificables de Cierre Cumplidos para `feat-008`
1. [x] `server/services/catalog/liveCatalogSyncService.js` selecciona `sizes: true` y compara `sizes` en `deltaSyncRecentPosters` y `syncCatalogFromWeb` sin duplicar lógica.
2. [x] `tests/catalog/catalog-sync-sizes.test.js` pasa al 100% (3/3 PASS) cubriendo el caso de agregar una talla sin cambiar `basePrice`.
3. [x] `bash ./init.sh`, `bash scripts/check-architecture.sh`, `node scripts/validate-harness.mjs --min-score 100` y `npm run test:unit` pasan al 100% con 0 violaciones y 0 CRLF.
