# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de iniciar la implementación, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-000..025` en `done`)
- **Tareas completadas recientemente:** `feat-021` (`1b8e48c`), `feat-022` (`54b01ed`), `feat-023` (`57078b5`), `feat-024` (`0de5ef9`) y **`feat-025` (`done` — Selector de Cambio de Tamaño de Póster en Editar Venta de Mostrador)**.
- **Tareas pendientes en `feature_list.json`:** Ninguna (`WIP = 0`; `26/26` tareas del backlog completadas y certificadas).

---

## Contrato Certificado Recientemente: `feat-025` (`done`)

### Entregables Verificados en `feat-025`
1. **Utilidad Pura Capa 1 (`src/utils/editSaleItemSizes.js`)**:
   - Resolución de `availableSizes` desde `product.sizes` o tallas oficiales, actualización inmutable de `description`, `unitPrice`, `selectedSizeId` y `subtotal`, y conservación de tallas editables tras `'Cambiar diseño'`.
2. **UI & Hook (`EditSaleModal.jsx < 70L`, `useEditSaleForm.js < 120L`, `EditSaleItemsTable.jsx < 110L`)**:
   - Botones táctiles de 1 toque (`min-h-[44px]`, activo blanco `bg-white text-black`, `0` clases `amber-*`/`orange-*`) por cada talla disponible con recálculo en vivo de subtotal, `Total Recalculado` y método de pago.
3. **Backend (`saleKpiService.js` y `saleUpdateService.js`)**:
   - Proyección de `sizes: true` en `product` y conservación de `productId` / `customImageUrl` cuando únicamente cambia el tamaño del mismo diseño, validado con `validateOfficialItemPrice`.
4. **Evidencia Ejecutable**:
   - `30/30 PASS` en `edit-sale-change-size` + `surgery-064` + `p5-2-sales-closing-challenger`, `265/265` unit tests, `HARNESS_PASS` y `bash ./init.sh` `100/100` con `0 CRLF`.

---

## Exclusiones Explícitas (`Out-of-Scope`)
- Cero lectura o modificación de `.env`.
- Cero cambios en `prisma/schema.prisma`.
