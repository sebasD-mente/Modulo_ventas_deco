# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de iniciar la implementación, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-021` `done`; Siguiente en Cola: `feat-022 -> feat-023`)
- **Tareas completadas recientemente:** `feat-019` (`c9b88a0`), `feat-020` (`7b0523e`) y **`feat-021` (`done` — decimales `42.2 cm` + paridad exacta de 7 Vectores Dorados con Web Deco Vintage)**.
- **Cola DAG pendiente (`not-started`, ejecutar de 1 en 1 bajo `WIP = 1`):**
  1. **`feat-022` (`P0`, depende de `feat-021` `done`)**: Backend de Bandeja de Pedidos Web (`WebOrderInbox`), Webhook S2S en Tiempo Real, Sync Pull Resiliente y Cierre Atómico al Registrar Venta.
  2. **`feat-023` (`P1`, depende de `feat-022`)**: Vista `"Bandeja Web"` + Botón `"Importar Pedido Web"` con Ventana Flotante de Selección y Precarga al Formulario para `VENDEDOR_REDES` y `SUPER_ADMIN`.
- **Coordinación Inter-Repositorios (`Web Deco Vintage Proyect`):** Entregado el informe técnico completo en `C:\Users\sebas\Documents\nuve DRIVE\Comunicacion entre agentes\2026-11-18_INFORME_INTEGRACION_PEDIDOS_Y_COTIZADOR_WEB_DECO_VINTAGE.md` (inspección en solo lectura; el repositorio vecino permanece 100% intacto para ser planificado y ejecutado por sus propios agentes).

---

## Contrato Certificado Recientemente: `feat-021` (`done`)

### Alcance Incluido (`In-Scope`) en `feat-021`
1. **Motor Puro de Precio Personalizado con Decimales (`src/utils/customPosterPricing.js` — Capa 1 `utils`)**:
   - Exportar `parseDecimalCm(raw)` aceptando tanto punto como coma decimal (`'42.2'` o `'42,2'` -> `42.2`).
   - Exportar `CUSTOM_MIN_CM = 5` y `CUSTOM_MAX_CM = 300`.
   - Exportar `calculateCustomPosterPrice({ mode, material, selectedSize, customWidth, customHeight, quantity = 1, cm2Rate = 0.048, woodCutSurcharge = 25.00, pvcSurcharge = 15.00, vinylFactor = 0.50 })`:
     - En `mode === 'CUSTOM'`:
       - `area = Number((w * h).toFixed(2))`
       - `basePrint = area * cm2Rate`
       - `MDF_5_5MM`: `rawUnit = basePrint + 25.00` (corte especial de madera en taller acordado para ambos sistemas)
       - `PVC_5MM`: `rawUnit = basePrint + 15.00`
       - `VINILO_SOLO`: `rawUnit = basePrint * 0.50`
     - En `mode === 'STANDARD'`:
       - `MDF_5_5MM`: `selectedSize.precio` (sin recargo de Q25)
       - `PVC_5MM`: `selectedSize.precio + 15.00`
       - `VINILO_SOLO`: `selectedSize.precio * 0.50`
     - Redondeo canónico exacto: `unitPrice = Number(rawUnit.toFixed(2))`, `subtotal = Number((unitPrice * qty).toFixed(2))`.

2. **Vectores Dorados Obligatorios (`cm2Rate = 0.048`)**:
   - `42.2 x 30 cm`, `MDF_5_5MM`, `qty = 1` -> `area = 1266`, `unitPrice = 85.77`, `subtotal = 85.77`
   - `42.2 x 30 cm`, `MDF_5_5MM`, `qty = 2` -> `area = 1266`, `unitPrice = 85.77`, `subtotal = 171.54`
   - `42.2 x 30 cm`, `PVC_5MM`, `qty = 1` -> `area = 1266`, `unitPrice = 75.77`, `subtotal = 75.77`
   - `42.2 x 30 cm`, `VINILO_SOLO`, `qty = 1` -> `area = 1266`, `unitPrice = 30.38`, `subtotal = 30.38`
   - `42.2 x 58.5 cm`, `MDF_5_5MM`, `qty = 1` -> `area = 2468.7`, `unitPrice = 143.50`, `subtotal = 143.50`
   - `48.5 x 68.25 cm`, `MDF_5_5MM`, `qty = 3` -> `area = 3310.13`, `unitPrice = 183.89`, `subtotal = 551.67`
   - `40 x 50 cm`, `MDF_5_5MM`, `qty = 1` -> `area = 2000`, `unitPrice = 121.00`, `subtotal = 121.00`

3. **Formulario `CustomItemModal.jsx` y Badge Móvil en `ProductionOrderCard.jsx`**:
   - En `src/components/manual-sale/CustomItemModal.jsx` (`<= 280` líneas): agregar `step="0.01"` e `inputMode="decimal"` a los inputs de ancho y alto (`min="5" max="300"`), delegar el cálculo a `calculateCustomPosterPrice`, conservar `customDimensions` con decimales limpios (`Especial: 42.2 x 30 cm (Corte Taller)`) y mantener intactos `resetModalState()`, carga múltiple y guardarraíles de `surgery-061`.
   - En `src/components/production/ProductionOrderCard.jsx`: actualizar la expresión regular de medidas en `extractPosterSizeInfo` (`\d+(?:\.\d+)?`) para que Taller muestre medidas decimales sin truncar en móvil.
   - Crear `tests/sales/custom-decimal-pricing-parity.test.js`.

---

## Contratos Arquitectónicos para las Siguientes Tareas en Cola (`feat-022` y `feat-023`)
*(Al terminar `feat-021`, el Agente Ejecutor deberá actualizar esta sección activa antes de codificar `feat-022` y luego `feat-023`)*

- **`feat-022` (Backend `WebOrderInbox` + S2S)**:
  - Aislamiento total de BD: comunicación exclusivamente vía HTTPS S2S con `x-webhook-secret` (`WEB_ORDERS_WEBHOOK_SECRET || CATALOG_WEBHOOK_SECRET`) verificado con `crypto.timingSafeEqual`.
  - Endpoints: `POST /api/webhooks/web-orders` (público S2S, `401` sin firma válida), `GET /api/sales/web-orders`, `POST /api/sales/web-orders/sync` (pull desde `${WEB_CATALOG_URL}/api/custom-orders/integration/inbox`), `PATCH /api/sales/web-orders/:id/discard` y `PATCH /api/sales/web-orders/:id/restore`.
  - En `createRemoteSaleTransaction`: cuando venga `webOrderInboxId` / `webOrderNumber`, marcar `IMPORTADO` en la misma transacción ACID con bloqueo `HTTP 409` si ya fue importado, y notificar `PATCH ${WEB_CATALOG_URL}/api/custom-orders/integration/:orderNumber/status`.
- **`feat-023` (UI Bandeja Web + Modal Flotante de Importación)**:
  - **Regla de oro UX acordada con el usuario:** El formulario de *Pedidos / Venta* NUNCA debe aparecer precargado por sorpresa al entrar. Siempre inicia limpio; arriba del modo `REDES_PERSONALIZADO` muestra el botón **`Importar Pedido Web`** (con contador de pendientes) que abre la **ventana flotante `WebOrdersImportModal.jsx`**, desde donde el vendedor escoge el pedido deseado y recién ahí se precargan cliente + pósters + fotos HD + medidas decimales + precios.
  - Además, pestaña **`Bandeja Web`** (`id: 'bandeja-web'`) en `Header.jsx` (`<= 280L`) y `App.jsx` (`WebOrdersInboxView.jsx <= 280L`) para `VENDEDOR_REDES` y `SUPER_ADMIN` con filtros `Pendientes / Importados / Descartados` y botón `Importar a Venta`.
  - Respetar estrictamente techos de líneas (`FastManualSaleForm.jsx <= 350L`, `useRemoteSaleForm.js <= 350L`, `Header.jsx <= 280L`), controles `>= 44px`, estética blanca/neutra (`0` `amber-*`/`orange-*`) y `0 CRLF`.

## Exclusiones Explícitas (`Out-of-Scope`)
- Cero lectura o modificación de `.env`.
- Cero escritura en el repositorio vecino `C:\Users\sebas\Documents\Antigravity Files\Web Deco Vintage Proyect`.
- Cero conexión directa entre bases de datos PostgreSQL de ambos proyectos.
