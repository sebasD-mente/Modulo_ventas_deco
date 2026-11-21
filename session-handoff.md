# Session Handoff

## Current Objective
- **Goal:** Completada y certificada `feat-025` (`sesion-036`), habilitando el cambio de tamaño de póster con 1 toque dentro del modal `'Editar venta'` de Ventas de Mostrador con recálculo reactivo y transaccional completo.
- **Current status:** `clean-state` (`WIP = 0`; `feat-000..025` en `done`; `Overall: 100/100`).
- **Branch / commit:** `main` (`feat-025` verificada con `0 CRLF`, `30/30` suites de edición/cirugía, `265/265` unit tests y `HARNESS_PASS`).

## Completed This Session
- [x] Creado `src/utils/editSaleItemSizes.js` (Capa 1 `utils`, `0` imports superiores) con hidratación de `availableSizes` desde `product.sizes` o tallas oficiales, actualización inmutable de talla/precio/subtotal y conservación de tallas tras `'Cambiar diseño'`.
- [x] Integrado `handleChangeSize` en `src/components/sales/edit/hooks/useEditSaleForm.js` (`< 120L`), `src/components/EditSaleModal.jsx` (`< 70L`) y `src/components/sales/edit/EditSaleItemsTable.jsx` (`< 110L`) con píldoras táctiles `min-h-[44px]` de estado activo blanco (`bg-white text-black`).
- [x] Añadido `sizes: true` en `server/services/sales/saleKpiService.js` y `server/services/sales/saleUpdateService.js`, preservando `productId` y `customImageUrl` cuando solo cambia la talla, y creada `tests/sales/edit-sale-change-size.test.js`.

## Blockers / Risks
- Ninguno activo. Todas las 26 tareas (`feat-000..025`) están en `done` con `0` violaciones arquitectónicas y `0 CRLF`.

## Files Touched
- `src/utils/editSaleItemSizes.js`
- `src/components/sales/edit/hooks/useEditSaleForm.js`
- `src/components/sales/edit/EditSaleItemsTable.jsx`
- `src/components/EditSaleModal.jsx`
- `server/services/sales/saleKpiService.js`
- `server/services/sales/saleUpdateService.js`
- `tests/sales/edit-sale-change-size.test.js`
- `feature_list.json`
- `sprint-contract.md`
- `progress.md`
- `session-handoff.md`

## Recommended Next Step
- Iniciar la siguiente sesión con `bash ./init.sh`. Cuando el usuario lo indique, ejecutar `npm run deploy` para subir `feat-025` a producción.
