# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de iniciar la implementación, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-000..024` en `done`)
- **Tareas completadas recientemente:** `feat-021` (`1b8e48c`), `feat-022` (`54b01ed`), `feat-023` (`57078b5`) y **`feat-024` (`done` — Endurecimiento Post-Integración del Pipeline S2S de Pedidos Web)**.
- **Tareas pendientes en `feature_list.json`:** Ninguna (`WIP = 0`; `25/25` tareas del backlog completadas y certificadas).

---

## Contrato Certificado Recientemente: `feat-024` (`done`)

### Entregables Verificados en `feat-024`
1. **Estabilidad React sin Bucle de Refresco (`WebOrdersInboxView.jsx` `278L <= 280L` y `App.jsx` `394L <= 420L`)**:
   - `onCountsChanged` encapsulado en `useRef` fuera de las dependencias de `loadOrders`, disparando `setWebOrdersRefreshKey` únicamente cuando `meta?.mutated === true`.
2. **Orden Cronológico Real (`webOrderInboxService.js`)**:
   - `listWebOrders` ordena por `[{ webCreatedAt: 'desc' }, { createdAt: 'desc' }]` y `syncWebOrdersFromWeb` inserta en orden cronológico para mostrar siempre primero el pedido más reciente de `decovintage.online`.
3. **Resolución Multi-SKU y Extracción de Cliente desde Notas (`webOrderInboxService.js` y `useWebOrderImport.js` `277L <= 280L`)**:
   - Coincidencia por `it.sku`, `WEB-${posterId}` y `WEB-${legacyId}` hacia `Product.id`, y extracción automática de nombre, dirección y departamento desde `'Cliente: ... | Entrega: ... (Depto)'`.
4. **Borrado Definitivo de Descartados / Pruebas (`DELETE /api/sales/web-orders/:id`)**:
   - `deleteWebOrder` + `deleteWebOrderHandler` + botón `'Eliminar'` (`min-h-[44px]`) en pestaña `Descartados` con bloqueo `HTTP 409` sobre órdenes `IMPORTADO` y registro en `AuditLog`.
5. **Evidencia Ejecutable**:
   - `34/34 PASS` en suites `feat-021..024`, `265/265` unit tests, `HARNESS_PASS` y `bash ./init.sh` `100/100` con `0 CRLF`.

---

## Exclusiones Explícitas (`Out-of-Scope`)
- Cero lectura o modificación de `.env`.
- Cero escritura en el repositorio vecino `C:\Users\sebas\Documents\Antigravity Files\Web Deco Vintage Proyect`.
- Cero conexión directa entre bases de datos PostgreSQL de ambos proyectos.
