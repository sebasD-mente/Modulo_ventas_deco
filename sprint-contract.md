# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-016` Completada y Verificada)
- **Tareas recientes completadas:** `feat-013`, `feat-014`, `feat-015` y `feat-016` (`done`).
- **Tarea activa en cola DAG:** Ninguna (`WIP = 0`; `feat-000..016` en `done`).
- **Marcha de trabajo ejecutada:** `Modo Diario Ágil` (`WIP = 1` durante implementación, cerrada en `CLEAN STATE` `100/100`).

---

## Alcance Incluido (`In-Scope`) para `feat-016`

1. **Desbloqueo de Cola Masiva (> 300+ diseños) y Exclusión de Ventas Anuladas (`server/services/productionService.js`, `useProductionQueue.js`, `usePrintSheets.js`, `ProductionManagementView.jsx`)**:
   - En `getProductionItems` (`productionService.js`): elevar el tope máximo permitido de `limit` de `100` a `1000` (`Math.min(1000, Math.max(1, parseInt(limit, 10) || 500))`), excluir ventas anuladas (`sale: { status: { not: 'ANULADA' }, ... }`) tanto en `getProductionItems` como en `getProductionMetrics`, e incluir `productionLogs: { include: { user: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'desc' } }` en cada ítem consultado.
   - En `useProductionQueue.js` y `ProductionManagementView.jsx`: consultar con `limit=500` y estado `page` + `pagination`, mostrando un indicador claro `"Mostrando X de Y diseños"` y paginador accesible (`min-h-[44px]`) cuando `totalPages > 1`. En `usePrintSheets.js`: elevar `limit` de `100` a `500` al consultar ítems sin pliego.

2. **Tamaño del Póster 100% Visible en Celular + Cero Color Naranja (`src/components/production/ProductionOrderCard.jsx` y `ProductionManagementView.jsx`)**:
   - Extraer de forma determinista el tamaño del póster desde `item.description` (p. ej. el sufijo entre paréntesis `(Mini | Pequeño | Mediano | Grande | Gigante)` al final de la descripción, limpiándolo del título si se muestra aparte) y/o `item.customDimensions`.
   - Renderizar en `ProductionOrderCard.jsx` un **badge prominente e imposible de truncar (`shrink-0`) con el Tamaño del Póster** (ej. `📐 Mediano`) y la **Cantidad** (`x2`) en primera vista móvil, cambiando el título `truncate` de 1 línea por `line-clamp-2 break-words` para que en pantallas angostas jamás se corte ni oculte el tamaño ni la obra.
   - Erradicar por completo cualquier clase naranja/ámbar (`bg-amber-*`, `text-amber-*`, `border-amber-*`) en `ProductionOrderCard.jsx` y `ProductionManagementView.jsx`, utilizando botones/badges limpios en blanco, verde esmeralda, cian o gris neutro.

3. **Separación Estricta `Cola Pendiente` vs `Archivo Inmutable de Resueltos` para `OPERARIO_1` y `OPERARIO_2` (`productionService.js`, `useProductionQueue.js`, `ProductionFilterTabs.jsx`, `ProductionOrderCard.jsx`)**:
   - **Comportamiento por defecto (Cola Activa):**
     - `OPERARIO_1` (Stock / Producción 1): abre por defecto en su **Cola Pendiente** (`status = 'PENDIENTE'`). En el mismo instante en que marca un diseño como **`📦 Separar Stock` (`SEPARADO`)** o **`🖨️ Enviar a Imprimir` (`A_PRODUCCION`)**, el ítem **desaparece inmediatamente de su cola activa** y pasa a su pestaña **`Archivo de Resueltos`** (`ARCHIVO_OP1` / estados `['SEPARADO', 'A_PRODUCCION', 'IMPRESO']`).
     - `OPERARIO_2` (Impresión 2 / Taller): abre por defecto en su **Cola por Imprimir** (`status = 'A_PRODUCCION'`), y ahora dispone también de su pestaña **`Archivo de Impresos`** (`status = 'IMPRESO'`). En el mismo instante en que marca un diseño como **`✅ Marcar como IMPRESO`**, el ítem **desaparece inmediatamente de su cola por imprimir** y pasa a su **`Archivo de Impresos`**.
     - `SUPER_ADMIN`: puede conmutar entre **Cola Activa** (`PENDIENTE` / `A_PRODUCCION`) y **Archivo de Resueltos** (`SEPARADO` / `A_PRODUCCION` / `IMPRESO`) con visibilidad completa.
   - **Inmutabilidad Estricta Anti-Salto de Trabajo (Backend + UI):**
     - En `updateItemProductionStatus` (`productionService.js`):
       - Si el usuario es `OPERARIO_1` (sin `SUPER_ADMIN`), **SOLO puede actuar sobre ítems cuyo estado actual sea `PENDIENTE`** (`item.productionStatus === 'PENDIENTE'`) hacia `'SEPARADO'` o `'A_PRODUCCION'`. Si `item.productionStatus !== 'PENDIENTE'`, rechazar con `HTTP 403` (`"Este diseño ya fue procesado y archivado de forma inmutable."`) e impedir volver a `'PENDIENTE'` o alterar un registro ya resuelto.
       - Si el usuario es `OPERARIO_2` (sin `SUPER_ADMIN`), **SOLO puede actuar sobre ítems en `A_PRODUCCION`** hacia `'IMPRESO'`. Si ya está en `'IMPRESO'`, es `100%` inmutable (`HTTP 403`).
     - En `ProductionOrderCard.jsx` (modo archivo / ítem ya resuelto para ese rol):
       - **Cero botones de modificación** (100% solo lectura para operarios).
       - Mostrar bloque de **Registro Inmutable de Auditoría** con:
         - **Acción ejecutada** (`Separado de Stock`, `Enviado a Impresión` o `Impreso en Taller`),
         - **Usuario responsable** (`fullName` del operario extraído de `productionLogs`),
         - **Fecha y hora exacta** en zona horaria `America/Guatemala` (`es-GT`).
         *(Cuando un ítem pasó por Operario 1 -> `A_PRODUCCION` y luego Operario 2 -> `IMPRESO`, mostrar ambos sellos cronológicos: quién y cuándo lo mandó a imprimir, y quién y cuándo terminó la impresión).*

4. **Guardarraíles de Suites Existentes**:
   - Preservar `const isVendedorRedesOnly = Boolean(isVendedorRedes && !isSuperAdmin && !isOperario1 && !isOperario2);` y `{!isVendedorRedesOnly && (` en `ProductionManagementView.jsx` (`tests/unit/production-seller-isolation.test.js`).
   - Preservar `if (isVendedorRedesOnly || source === 'PEDIDOS')` en `getProductionItems` y `getProductionMetrics` (`tests/unit/production-seller-isolation.test.js`).
   - Preservar el debounce exacto de `250ms` (`debouncedSearchQuery`, `setTimeout`, `250`, `clearTimeout(timer)`) en `useProductionQueue.js` (`tests/production/production-adversarial.test.js`).
   - Preservar `min-h-[44px]` en `ProductionFilterTabs.jsx` (`tests/frontend/phase5-frontend-ergonomics-resilience.test.js`).

## Exclusiones Explícitas (`Out-of-Scope`)
- Cero lectura o modificación de `.env`.
- Cero modificaciones en `prisma/schema.prisma` (reutilizar `SaleItem` y `ProductionLog` ya existentes).
