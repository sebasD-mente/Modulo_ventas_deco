# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de cerrar la entrega, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-012` Completada y Verificada)
- **Tarea completada:** `feat-012` — Simplificación Visual de Mis Comisiones (`VENDEDOR_REDES`): 3 Tarjetas sin Flete, Cero Color Naranja, Retiro de Banner del 20% y Badge de Última Liquidación.
- **Estado en `feature_list.json`:** `done` (`WIP = 0`).
- **Marcha de trabajo ejecutada:** `Modo Diario Ágil` (`61/61` commission frontend tests PASS, `265/265` unit tests PASS, `bash ./init.sh` `100/100`).

---

## Alcance Incluido (`In-Scope`) para `feat-012`
1. **Retiro de la tarjeta `"Flete Administrado"` y redistribución en 3 columnas (`SellerCommissionDashboard.jsx`)**:
   - Eliminar el bloque KPI 3 (`Flete Administrado`).
   - Cambiar la grilla superior de `grid-cols-2 sm:grid-cols-4` a `grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4` para que las 3 tarjetas restantes (**Comisiones Listas**, **Base Productos** y **En Espera de Saldo**) ocupen equitativamente todo el ancho disponible.
2. **Erradicación del color naranja/ámbar en `"En Espera de Saldo"` (`SellerCommissionDashboard.jsx`)**:
   - Quitar `text-amber-400` del título, del ícono `Clock` y del contador principal de órdenes en la tarjeta **En Espera de Saldo**.
   - Aplicar exactamente la misma estética blanca/neutra de **Base Productos**: título `text-neutral-300`, ícono `text-neutral-400`, monto/conteo principal `text-white` y subtítulo `text-neutral-400`.
   - Regla general persistida en `memory/topics/harness-rules.md`: evitar de ahora en adelante textos o botones de color naranja/ámbar en la interfaz.
3. **Retiro del banner gigante del 20% (`SellerCommissionDashboard.jsx`)**:
   - Eliminar por completo el bloque `bg-amber-950/30 border border-amber-800/60` que muestra `"💡 El 20% de comisión se habilita automáticamente cuando el cliente liquida el 100% de la orden..."` debajo de las tarjetas KPI.
4. **Badge de Fecha de Última Liquidación junto al botón de actualizar (`CommissionSettlementView.jsx` y `SellerCommissionDashboard.jsx`)**:
   - Pasar el listado de liquidaciones (`settlements`) o la última liquidación válida desde `CommissionSettlementView.jsx` hacia `SellerCommissionDashboard.jsx` (y refrescar `fetchSettlements()` junto con `fetchPendingCommissions()` en `onRefresh`).
   - En la cabecera del panel **"Ventas Elegibles para Liquidar"**, justo al lado izquierdo del botón de actualizar (`RefreshCw`), renderizar un badge visible en tonos neutros/blancos (`bg-neutral-900 border border-neutral-800 text-neutral-300`) que indique `Última liquidación: <fecha es-GT>` (o `Última liquidación: Sin registros` cuando el vendedor aún no tenga liquidaciones emitidas/pagadas).
5. **Alineación de Suites de Pruebas (`tests/commissions/commission-frontend.test.js` y `tests/adversarial/sprint5-commission-frontend-challenger.test.js`)**:
   - Actualizar las aserciones estáticas que buscaban el antiguo banner educativo (`4.1` en `commission-frontend.test.js`) para verificar el nuevo contrato: grilla `sm:grid-cols-3`, ausencia de la tarjeta `"Flete Administrado"`, ausencia de clases `amber-`/`orange-` en `SellerCommissionDashboard.jsx` y presencia del badge `"Última liquidación"`.

## Exclusiones Explícitas (`Out-of-Scope`)
- No alterar la fórmula matemática del 20% sobre base neta de productos en `server/services/commissionService.js`.
- No superar el techo de `280` líneas en `SellerCommissionDashboard.jsx` ni en `CommissionSettlementView.jsx`.
