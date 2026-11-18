# Session Handoff

## Current Objective
- **Goal:** Completada `feat-020` para incluir el costo de Edición de Diseño en la base comisionable del 20% del vendedor de redes (excluyendo únicamente el flete de envío), sin alterar `prisma/schema.prisma`.
- **Current status:** `clean-state` (`WIP = 0`; `feat-000..020` en `done`; `Overall: 100/100`).
- **Branch / commit:** `main` (`feat-020` completada y verificada en local con `0 CRLF`).

## Completed This Session
- [x] Implementado y exportado `extractSaleEditionCost(sale)` en `server/services/commissionService.js` (leyendo `sale.editionCost` o el sello `[Edición (+Q X.XX): ...]` en `sale.notes`), sumándolo en `calculateSaleProductBase(sale)` (`Math.max(0, itemsSubtotal - discount) + editionCost`, excluyendo el 100% de `shippingCost` y evitando doble conteo en la rama fallback `totalAmount - shippingCost`) y enriqueciendo `settlement.sales` en `getSettlementById`.
- [x] Actualizado `src/components/commissions/SettlementDetailReceiptModal.jsx` (`267L <= 280L`) con `extractReceiptEditionCost` y `calculateReceiptRowAmounts`, preservando estrictamente `s.baseProductos ??`.
- [x] Actualizado `tests/sales/remote-sale-design-edition.test.js`, alineado `MockCommissionStore` en `tests/adversarial/m3-commission-invariants-challenger.test.js` y creada la suite `tests/commissions/commission-design-edition-inclusion.test.js` (`122/122 PASS` en la batería completa de comisiones/edición, `265/265` unit tests PASS, `53/53` voice tests PASS y `HARNESS_PASS`).

## Blockers / Risks
- Ninguno activo.

## Files Touched
- `server/services/commissionService.js`
- `src/components/commissions/SettlementDetailReceiptModal.jsx`
- `tests/sales/remote-sale-design-edition.test.js`
- `tests/commissions/commission-design-edition-inclusion.test.js`
- `tests/adversarial/m3-commission-invariants-challenger.test.js`
- `feature_list.json`
- `sprint-contract.md`
- `progress.md`
- `session-handoff.md`

## Recommended Next Step
- Iniciar próxima sesión con `bash ./init.sh`; desplegar `feat-020` a producción (`npm run deploy`) si el usuario lo solicita o registrar la siguiente tarea en `feature_list.json`.
