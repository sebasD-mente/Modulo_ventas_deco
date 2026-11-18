# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de iniciar la implementación, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-020` Completada y Verificada)
- **Tareas recientes completadas:** `feat-017`, `feat-018`, `feat-019` (`c9b88a0`) y `feat-020` (`done`).
- **Siguiente tarea planificada en cola DAG:** Ninguna pendiente (`WIP = 0`; `feat-000..020` en `done`).
- **Marcha de trabajo ejecutada:** `Modo Diario Ágil` (`WIP = 1 -> 0`, verificación en 3 puertas `bash ./init.sh` `100/100` + `npm run harness:check` `HARNESS_PASS`).

---

## Alcance Incluido (`In-Scope`) para `feat-020`

1. **Incluir el Costo de Edición de Diseño en la Base Comisionable del 20% (`server/services/commissionService.js`)**:
   - Exportar una función pura `extractSaleEditionCost(sale = {})`:
     - Si `sale?.editionCost != null && Number.isFinite(Number(sale.editionCost)) && Number(sale.editionCost) > 0`, retorna `Number(Number(sale.editionCost).toFixed(2))`.
     - En caso contrario, si `typeof sale?.notes === 'string'` coincide con `/\[Edici[oó]n\s*\(\+Q\s*([0-9]+(?:\.[0-9]{1,2})?)\)/i`, retorna `Number(Number(match[1]).toFixed(2))`.
     - En cualquier otro caso retorna `0`.
   - Actualizar `calculateSaleProductBase(sale)` para que cuando se calcule a partir de `sale.itemsSubtotal` o de `sale.items`:
     ```js
     const netProducts = Math.max(0, itemsSub - Number(sale.discount || 0));
     const editionCost = extractSaleEditionCost(sale);
     return Number((netProducts + editionCost).toFixed(2));
     ```
     *(Y cuando no venga ni `itemsSubtotal` ni `items`, la rama fallback `totalAmount - shippingCost` ya incluye el valor de la edición y excluye el 100% del flete).*
   - En `getSettlementById({ tenantId, settlementId })`: enriquecer `settlement.sales` mapeando cada venta con `baseProductos: calculateSaleProductBase(s)` y `commissionAmount: Number((calculateSaleProductBase(s) * 0.20).toFixed(2))` para que el modal de recibo detallado reciba siempre la base exacta con edición incluida.

2. **Alineación en Recibo de Liquidación (`src/components/commissions/SettlementDetailReceiptModal.jsx`)**:
   - En el cálculo de respaldo por fila de `SettlementDetailReceiptModal.jsx`, asegurar que si llegara un objeto con `s.itemsSubtotal` sin `s.baseProductos`, sume también el cargo de edición extraído de `s.editionCost` o `s.notes` (`extractReceiptEditionCost`), **conservando obligatoriamente `s.baseProductos ??`** (y jamás `||`).
   - *(Nota: `OnlineSalesHistoryModal.jsx` ya calcula `Math.max(0, Number(sale.totalAmount || 0) - Number(sale.shippingCost || 0))`, por lo que ya incluye automáticamente la edición y excluye el flete).*

3. **Actualización de Contrato en `feat-019` y Nueva Suite de Comisiones (`tests/sales/remote-sale-design-edition.test.js` + `tests/commissions/commission-design-edition-inclusion.test.js`)**:
   - En `tests/sales/remote-sale-design-edition.test.js` (test `3.2`): actualizar la aserción de `calculateSaleProductBase(sale)` de `130` a `155` (`2x Q65 = Q130` en pósters + `Q25` de edición = **`Q155.00`** de base comisionable -> **`Q31.00`** de comisión 20%, manteniendo excluido el flete de `Q35`).
   - Crear `tests/commissions/commission-design-edition-inclusion.test.js` validando:
     1. `extractSaleEditionCost` y `calculateSaleProductBase` tanto con `editionCost` directo como leído desde `sale.notes` (`[Edición (+Q 25.00): ...]`) tal como sale de PostgreSQL.
     2. Combinación de productos + descuento + edición + flete (confirmando que la edición SÍ suma a la comisión del 20% y el flete NUNCA suma).
     3. `getPendingCommissions` (`totalProductsAmount`, `totalCommission`, `sales[i].commissionAmount` y `waitingSummary.potentialCommission`), `createSettlementTransaction` (`totalProductsAmount` y `totalCommission`) y `getSettlementById` (`settlement.sales[i].baseProductos`).

4. **Guardarraíles Innegociables de Suites Existentes**:
   - En `SettlementDetailReceiptModal.jsx`, preservar exactamente `s.baseProductos ??` (`tests/commissions/commission-frontend.test.js` test `5.5` falla si se usa `||` o se quita `s.baseProductos ??`).
   - Para ventas sin edición (`editionCost = 0` y sin sello en `notes`), `calculateSaleProductBase(sale)` debe devolver exactamente los mismos valores que antes (`tests/domain3/commission.test.js` y `tests/adversarial/m3-commission-invariants-challenger.test.js` 100% en verde; alineando `MockCommissionStore` de `m3-commission-invariants-challenger.test.js` al predicado Prisma `{ status: { in: [...] } }` y al ciclo de 2 pasos `PENDIENTE_PAGO -> PAGADO` de `surgeries-zero-compromise.test.js` 1.1 sin relajar ninguna aserción matemática ni de compuerta HTTP 422).
   - Mantener `SettlementDetailReceiptModal.jsx <= 280` líneas y `0 CRLF` en todos los archivos tocados.

## Exclusiones Explícitas (`Out-of-Scope`)
- Cero lectura o modificación de `.env`.
- Cero modificaciones en `prisma/schema.prisma`.
- Cero cambios en la regla de exclusión estricta del flete (`shippingCost` sigue 100% excluido de comisión).
