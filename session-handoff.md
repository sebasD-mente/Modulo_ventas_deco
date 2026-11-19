# Session Handoff

## Current Objective
- **Goal:** Completada y certificada `feat-021` (`sesion-032`), habilitando medidas especiales con decimales (`42.2 cm`) y paridad matemática exacta al centavo con Web Deco Vintage (`+Q 25.00` corte especial MDF, `+Q 15.00` PVC, `50%` Vinilo Solo). Listo el repositorio para ejecutar secuencialmente `feat-022` (Backend `WebOrderInbox` + S2S) y `feat-023` (UI Bandeja Web + ventana flotante `"Importar Pedido Web"`).
- **Current status:** `clean-state` (`WIP = 0`; `feat-000..021` en `done`; `feat-022` y `feat-023` en `not-started` en orden secuencial DAG; `Overall: 100/100`).
- **Branch / commit:** `main` (`feat-021` verificada con `0 CRLF`, `53/53` suite decimal/cotizador, `265/265` unit tests, `53/53` voice tests y `HARNESS_PASS`).

## Completed This Session
- [x] Creado el motor puro `src/utils/customPosterPricing.js` (Capa 1 `utils`, 0 imports superiores) con `parseDecimalCm`, `formatDecimalCm`, `validateCustomDimensions`, `normalizePosterMaterial` y `calculateCustomPosterPrice` redondeando `area`, `unitPrice` y `subtotal` de forma idéntica a Web Deco Vintage.
- [x] Actualizado `src/components/manual-sale/CustomItemModal.jsx` (`252L <= 280L`) incorporando `step="0.01"` e `inputMode="decimal"` en los inputs de Ancho y Alto (`min="5" max="300"`), consumiendo `calculateCustomPosterPrice` y `validateCustomDimensions`, y preservando decimales limpios en `customDimensions` (`Especial: 42.2 x 30 cm (Corte Taller)`).
- [x] Mejorado `extractPosterSizeInfo` en `src/components/production/ProductionOrderCard.jsx` para extraer medidas decimales (`\d+(?:\.\d+)?`) con y sin paréntesis anidados `(Corte Taller)` en el badge móvil de Taller.
- [x] Añadida y certificada la suite `tests/sales/custom-decimal-pricing-parity.test.js` (`15/15 PASS`, `53/53` junto con suites de regresión del cotizador, `265/265` `test:unit`, `53/53` `test:voice`, `HARNESS_PASS` y `bash ./init.sh` `100/100`).

## Blockers / Risks
- Ninguno para continuar con `feat-022` y `feat-023`. **Nota técnica importante para `feat-022`:** al añadir `model WebOrderInbox` en `prisma/schema.prisma`, revisar la aserción de conteo de modelos en `tests/schema/schema-robustness.test.js` (`Prisma.dmmf debe contener los 11 modelos definidos` -> `12` modelos) si `feat-022` forma parte de su verificación obligatoria, respetando estrictamente no debilitar ningún candado de integridad referencial ni índices.

## Files Touched
- `src/utils/customPosterPricing.js`
- `src/components/manual-sale/CustomItemModal.jsx`
- `src/components/production/ProductionOrderCard.jsx`
- `tests/sales/custom-decimal-pricing-parity.test.js`
- `feature_list.json`
- `sprint-contract.md`
- `progress.md`
- `session-handoff.md`

## Recommended Next Step
- Iniciar la siguiente sesión ejecutando `bash ./init.sh`, pasar **únicamente `feat-022`** a `"status": "in-progress"` (`WIP = 1`), actualizar `sprint-contract.md` para `feat-022`, e implementar el backend `WebOrderInbox` + Webhook S2S `POST /api/webhooks/web-orders` + Sync Pull + cierre atómico en `createRemoteSaleTransaction`.
