# Progress Log - worker_m1

Last visited: 2026-09-19T22:04:30Z

## Status
Milestone 1 (Dominio 1: Ventas de Redes, CRM y Anticipos 50/50) COMPLETED.

## Completed Items
1. ✅ Updated `scripts/audit-monoliths.js` with DOMAIN_CEILINGS for remoteSaleService (350), printSheetService (280), commissionService (300), remoteSaleController (250), and apiRoutes (350).
2. ✅ Created `server/validators/remoteSaleValidators.js` with customerSchema, remoteSaleItemSchema, remoteSalePaymentSchema, createRemoteSaleSchema (with 50% deposit and customer refines), and balancePaymentSchema.
3. ✅ Created `server/services/sales/remoteSaleService.js` with findOrCreateCustomer, createCustomer (409 on duplicate phone), getCustomersList, getCustomerById (360 LTV & balance metrics), createRemoteSaleTransaction (strict 50% gate, evt-ventas-redes-online fallback, ACID transaction, idempotency replay), and registerBalancePayment.
4. ✅ Created `server/controllers/remoteSaleController.js` exposing getCustomers, createCustomer, getCustomer360, createRemoteSale, and registerBalancePayment.
5. ✅ Updated `server/routes/apiRoutes.js` mounting all 5 Domain 1 endpoints under `requireRole(['SUPER_ADMIN', 'VENDEDOR', 'VENDEDOR_REDES'])` without `requireEventAccess`.
6. ✅ Verified with `npm run test:security` (9/9 PASS), `npm run audit:secrets` (0 leaks), `npm run audit:monoliths` (0 violations), `npm run build` (success), and `npm run harness:check` (100% green).
