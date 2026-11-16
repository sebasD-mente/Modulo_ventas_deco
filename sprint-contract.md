# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-011` Completada y Verificada en Producción)
- **Estado de sesión:** Todas las tareas `feat-000..011` concluidas (`WIP = 0`).
- **Última tarea completada:** `feat-011` — Limpieza única en 0 de los datos de prueba de Ventas en Línea en el VPS de Producción (sin UI destructiva).
- **Marcha de trabajo acordada:** `Modo Diario Ágil`.

---

## Criterios Verificables de Cierre Cumplidos para `feat-010` y `feat-011`
1. [x] Commit `f8ea38a` desplegado en `https://ventas.decovintage.online` (sin botón `"Reiniciar en 0"` ni endpoint `/sales/purge-online-test-data`).
2. [x] Limpieza única ejecutada en el contenedor de producción para `evt-ventas-redes-online`.
3. [x] Verificado en vivo con el token `VENDEDOR_REDES`: `totalSold: 0`, `salesCount: 0`, `allSalesCount: 0`, `commPendingCount: 0`, `commSettlementsCount: 0`, `trackingOrdersCount: 0`.
4. [x] `bash ./init.sh`, `bash scripts/check-architecture.sh` y `node scripts/validate-harness.mjs --min-score 100` en verde (`Overall: 100/100`).
