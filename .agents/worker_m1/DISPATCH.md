## 2026-09-19T21:59:04Z

MANDATORY FIRST STEP: Read c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\ORIGINAL_REQUEST.md completely, specifically the latest section under "## Follow-up — 2026-09-19T21:51:50Z". Also read survey_domain1.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP:
You own exclusively:
- scripts/audit-monoliths.js
- server/validators/remoteSaleValidators.js
- server/services/sales/remoteSaleService.js
- server/controllers/remoteSaleController.js
- server/routes/apiRoutes.js (mounting Domain 1 routes)

YOUR MISSION (Milestone 1 — Dominio 1: Ventas de Redes, CRM y Anticipos 50/50):
1. Update `scripts/audit-monoliths.js`:
   Incorporate into `DOMAIN_CEILINGS`:
   - 'server/services/sales/remoteSaleService.js': { max: 350, reason: 'Servicio transaccional cohesivo de ventas de redes, CRM y anticipos 50/50' }
   - 'server/services/printSheetService.js': { max: 280, reason: 'Gestor cohesivo de pliegos diarios y ciclo de vida de taller' }
   - 'server/services/commissionService.js': { max: 300, reason: 'Motor financiero transaccional de liquidaciones y cálculo del 20%' }
   - 'server/controllers/remoteSaleController.js': { max: 250, reason: 'Controlador integral de clientes y ventas remotas' }
   - 'server/routes/apiRoutes.js': { max: 350, reason: 'Manifiesto central de rutas de la API de STAND {IA}' }

2. Create `server/validators/remoteSaleValidators.js`:
   - `customerSchema` (fullName min 2 max 100 trim, phone regex 8-15 digits, email optional nullable, deliveryAddress min 5 optional nullable, department, municipality, sourceChannel enum ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'OTRO'] default 'WHATSAPP', notes max 500)
   - `remoteSaleItemSchema` (productId optional uuid nullable, description min 1, quantity positive int default 1, unitPrice non-negative number, isCustom boolean default false, material enum ['PVC_5MM', 'MDF_5_5MM', 'VINILO_SOLO'] optional nullable, customDimensions optional nullable, customImageUrl optional nullable)
   - `remoteSalePaymentSchema` (method enum ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO'], amount positive number, reference optional nullable, receiptUrl optional nullable)
   - `createRemoteSaleSchema` (eventId default 'evt-ventas-redes-online', customerId optional uuid, customer customerSchema optional, deliveryMethod enum ['PUNTO_VENTA', 'ENVIO_COURIER', 'RETIRO_EVENTO'] default 'ENVIO_COURIER', shippingCost non-negative default 0, shippingCourier optional, shippingTrackingNumber optional, pickupEventId optional required if RETIRO_EVENTO, items min 1, payments min 1, discount non-negative default 0, notes max 500, idempotencyKey optional. Refines: customerId or customer must exist, pickupEventId if RETIRO_EVENTO)
   - `balancePaymentSchema` (payments min 1 of remoteSalePaymentSchema, notes optional)

3. Create `server/services/sales/remoteSaleService.js`:
   - `findOrCreateCustomer(tenantId, customerData, tx = prisma)`: lookup by tenantId and phone. If exists, update address/department/etc.; if not, create.
   - `createCustomer({ tenantId, customerData })`: checks unique phone in tenantId. If exists, throws 409 error. If not, creates.
   - `getCustomersList({ tenantId, query, phone, page = 1, limit = 20 })`: paginated search by name or phone.
   - `getCustomerById({ tenantId, customerId })`: returns customer with sales history and metrics: totalOrders, ltv, pendingBalance, lastOrderDate.
   - `createRemoteSaleTransaction({ tenantId, sellerId, data, idempotencyKey })`:
     * Event: data.eventId || 'evt-ventas-redes-online'.
     * Arithmetic: itemsSubtotal = sum(round(quantity * unitPrice, 2)), productsAmount = max(0, round(itemsSubtotal - discount, 2)), totalAmount = round(productsAmount + shippingCost, 2), paymentsTotal = sum(round(p.amount, 2)).
     * Strict 50% Gate: requiredDeposit = round(totalAmount * 0.50, 2). If paymentsTotal < requiredDeposit - 0.01: throw 400 error ("Anticipo insuficiente: Se requiere al menos el 50% del total de la orden...").
     * If paymentsTotal >= totalAmount - 0.01: paymentStatus = 'PAGADO_TOTAL', depositAmount = totalAmount, balanceDue = 0.00, status = 'COMPLETADA'.
     * If totalAmount * 0.50 <= paymentsTotal < totalAmount: paymentStatus = 'ANTICIPO_PAGADO', depositAmount = paymentsTotal, balanceDue = round(totalAmount - paymentsTotal, 2), status = 'PENDIENTE'.
     * Inside prisma.$transaction:
       - customer resolution (findOrCreateCustomer if data.customer supplied).
       - atomic sequential saleNumber via generateSaleNumber(eventId, tx).
       - atomic create of Sale, SaleItem (with isCustom, material, customDimensions, customImageUrl, productionStatus: 'PENDIENTE'), SalePayment, and auditLog.
     * Idempotency handling: fast-path lookup if idempotencyKey provided, and catch P2002 for idempotent replay.
   - `registerBalancePayment({ saleId, tenantId, sellerId, payments, notes, tx })`:
     * Inside prisma.$transaction:
       - find sale by id and tenantId. Verify status !== 'ANULADA'.
       - Verify balanceDue > 0.
       - newPaymentsTotal = sum(p.amount). Verify Math.abs(newPaymentsTotal - balanceDue) <= 0.05.
       - create payments in SalePayment.
       - update Sale to balanceDue = 0.00, depositAmount = totalAmount, paymentStatus = 'PAGADO_TOTAL', status = 'COMPLETADA'.
       - auditLog record.

4. Create `server/controllers/remoteSaleController.js`:
   - `getCustomers`, `createCustomer`, `getCustomer360`, `createRemoteSale`, `registerBalancePayment`.

5. Update `server/routes/apiRoutes.js`:
   - Import validators and controllers.
   - Mount routes under requireRole(['SUPER_ADMIN', 'VENDEDOR', 'VENDEDOR_REDES']):
     * GET /api/customers -> getCustomers
     * POST /api/customers -> validate(customerSchema), createCustomer
     * GET /api/customers/:id -> getCustomer360
     * POST /api/sales/remote -> validate(createRemoteSaleSchema), createRemoteSale
     * POST /api/sales/:id/balance-payment -> validate(balancePaymentSchema), registerBalancePayment

6. VERIFICATION:
   - Run tests:
     * npm run test:security
     * npm run audit:monoliths
     * npm run build
   - Document commands and outputs in your handoff.md.
   - Notify parent orchestrator when complete.
