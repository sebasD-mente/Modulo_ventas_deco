# Project: STAND {IA} — Sprint 5: Frontend UI & Módulo Gerencial de Comisiones

## Architecture
- **Ecosistema**: STAND {IA} (Deco Vintage Guate) — Sistema POS y Venta Ferial con IA Multimodal
- **Frontend**: React 18 SPA impulsado por Vite y Tailwind CSS (`src/`).
- **Backend**: Node.js (ESM) con Express (`server/`) y PostgreSQL administrado con Prisma ORM (`prisma/schema.prisma`).
- **Separación de Vistas por Rol**:
  - `VENDEDOR_REDES`: Accede a `SellerCommissionDashboard.jsx`, visualiza comisiones acumuladas al 20%, ventas retenidas por saldo pendiente (`balanceDue > 0`), y su historial de pagos.
  - `SUPER_ADMIN`: Accede a `AdminCommissionPanel.jsx`, audita ventas elegibles por vendedor, genera liquidaciones atómicas `LIQ-YYYYMM-XXX` y registra pagos bancarios (`markPaid`).
- **Hook Cohesivo de Dominio**: `useCommissionSettlements.js` centraliza el estado reactivo, consumo de `/api/commissions/*`, filtros y mutaciones.
- **Invariante Financiero**: 20% estricto sobre subtotal neto de productos (`items - discount`), flete (`shippingCost`) 100% excluido con badge neutral, solo liquidables órdenes con `balanceDue === 0.00` y `status === 'COMPLETADA'`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Domain Hook `useCommissionSettlements.js` | Estado reactivo, consumo con `authFetch` de `/api/commissions/pending`, `/api/commissions/settle`, `/api/commissions/settlements`, `/api/commissions/settlements/:id`, `/api/commissions/settlements/:id/pay`, `/api/users`, filtros por vendedor/fechas/estado, cálculo reactivo de selección. | M1 | Survey / Request §R2, §R3, §R4 |
| 2 | Componente `CommissionSettlementView.jsx` | Vista contenedora principal lazy-loaded en `App.jsx`, conmuta entre vista de vendedor y panel de admin según rol, tabs secundarios (Resumen / Historial). | M2 | Survey / Request §R1 |
| 3 | Componente `SellerCommissionDashboard.jsx` | Tablero de comisiones para Vendedor de Redes: tarjetas KPI (20% comisiones listas, base productos, flete administrado, ventas en espera de saldo), banner educativo, tabla de ventas elegibles con badge flete excluido. | M2 | Survey / Request §R2 |
| 4 | Componente `AdminCommissionPanel.jsx` | Panel gerencial para Super Admin: selector de vendedor, filtros de fecha, lista de ventas con selección múltiple / seleccionar todas, cálculo en vivo de totales a liquidar, botón de emisión $\ge 44\text{px}$. | M2 | Survey / Request §R3 |
| 5 | Componente `ConfirmSettlementModal.jsx` | Modal de confirmación para emisión de `LIQ-YYYYMM-XXX`, resumen contable, notas opcionales, llamada a `POST /api/commissions/settle`, feedback visual (confetti/toast). | M3 | Survey / Request §R3 |
| 6 | Componente `MarkSettlementPaidModal.jsx` | Modal para registrar boleta/transferencia bancaria de desembolso (`paymentReference`, notas), llamada a `PATCH /api/commissions/settlements/:id/pay`, mutación a `PAGADO`. | M3 | Survey / Request §R4 |
| 7 | Componente `SettlementDetailReceiptModal.jsx` | Detalle 360° de liquidación (`GET /api/commissions/settlements/:id`) con encabezado institucional, desglose de ventas y estilos `@media print` para comprobante contable físico en PDF/papel. | M3 | Survey / Request §R5 |
| 8 | Componente `SettlementHistoryTable.jsx` | Tabla paginada de liquidaciones históricas con badges de estado (`PENDIENTE_PAGO` amber, `PAGADO` emerald), botón de registro de pago (solo admin) y clic para ver recibo. | M3 | Survey / Request §R4, §R5 |
| 9 | Integración en `Header.jsx` | Inyección de pestaña "Comisiones" (SUPER_ADMIN) / "Mis Comisiones" (VENDEDOR_REDES) con touch target $\ge 44\text{px}$. | M4 | Survey / Request §R1 |
| 10 | Integración y Montaje en `App.jsx` | `React.lazy()` de `CommissionSettlementView`, ruta activa `activeTab === 'comisiones'` bajo `<Suspense>`, protección de acceso por rol. | M4 | Survey / Request §R1 |
| 11 | Suite de Pruebas Frontend E2E / Integración | `tests/commissions/commission-frontend.test.js` con Node native test runner verificando techos, touch ergonomics, fórmulas del 20%, exclusión de flete, `@media print`, y Zero-Balance gate. | M5 | Survey / Quality Harness |
| 12 | Compuerta Maestra de Calidad | Validación de `npm run build`, `npm run audit:monoliths`, `npm run test:security`, `npm run audit:secrets`, `npm run harness:check`. | M5 | Survey / Quality Harness |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Domain Hook | `src/components/commissions/hooks/useCommissionSettlements.js` (338 líneas) | None | DONE |
| M2 | Core Views | `CommissionSettlementView.jsx` (201L), `SellerCommissionDashboard.jsx` (202L), `AdminCommissionPanel.jsx` (243L) | M1 | DONE |
| M3 | Modals & Tables | `ConfirmSettlementModal.jsx` (145L), `MarkSettlementPaidModal.jsx` (164L), `SettlementDetailReceiptModal.jsx` (238L), `SettlementHistoryTable.jsx` (220L) | M1, M2 | DONE |
| M4 | Navigation & Mount | `src/components/Header.jsx` (139L), `src/App.jsx` (218L) | M2, M3 | DONE |
| M5 | Test Suite & Quality Gate | `tests/commissions/commission-frontend.test.js` (45/45 pass), `npm run harness:check` (Exit 0) | M1, M2, M3, M4 | DONE |

## Interface Contracts

### `useCommissionSettlements(user, isSuperAdmin, authFetch)`
- **Input**:
  - `user`: `{ id, name, email, role, roles }`
  - `isSuperAdmin`: boolean
  - `authFetch`: function `(url, options) => Promise<Response>`
- **Returns**:
  - `pendingData`: `{ baseProductos, totalComisiones, totalFlete, salesCount, sales, salesWaitingBalance }`
  - `settlements`: array de liquidaciones históricas
  - `sellers`: array de vendedores `{ id, name, email }` (para super admin)
  - `selectedSellerId`: string (seller UUID seleccionado)
  - `setSelectedSellerId`: function `(id) => void`
  - `selectedSaleIds`: array de string (IDs de ventas seleccionadas para liquidar)
  - `toggleSaleSelection`: function `(saleId) => void`
  - `selectAllSales`: function `() => void`
  - `clearSaleSelection`: function `() => void`
  - `isAllSelected`: boolean
  - `calculatedSelection`: `{ count, baseAmount, commissionAmount }`
  - `dateRange`: `{ startDate, endDate }`
  - `setDateRange`: function `({ startDate, endDate }) => void`
  - `statusFilter`: string (`'ALL'`, `'PENDIENTE_PAGO'`, `'PAGADO'`)
  - `setStatusFilter`: function `(status) => void`
  - `loading`: boolean
  - `error`: string | null
  - `fetchPendingCommissions`: function `(sellerId?) => Promise<void>`
  - `fetchSettlements`: function `(filters?) => Promise<void>`
  - `emitSettlement`: function `({ sellerId, saleIds, notes }) => Promise<{ success, settlement, error }>`
  - `markSettlementPaid`: function `(settlementId, { paymentReference, notes }) => Promise<{ success, settlement, error }>`
  - `fetchSettlementDetail`: function `(settlementId) => Promise<object>`

### Endpoints Consumidos
- `GET /api/commissions/pending?sellerId=...` -> `{ success, data: { baseProductos, totalComisiones, totalFlete, salesCount, sales } }`
- `POST /api/commissions/settle` -> body `{ sellerId, saleIds, notes }` -> `{ success, data: settlement }`
- `GET /api/commissions/settlements?sellerId=...&status=...&page=...&limit=...` -> `{ success, data: { settlements, pagination } }`
- `GET /api/commissions/settlements/:id` -> `{ success, data: settlementWithSales }`
- `PATCH /api/commissions/settlements/:id/pay` -> body `{ paymentReference, notes }` -> `{ success, data: updatedSettlement }`
- `GET /api/users` -> `{ success, data: users }` (filtrar `VENDEDOR_REDES` / `VENDEDOR`)
- `GET /api/sales/events/:eventId` -> opcional para ventas con `balanceDue > 0`

## Code Layout
- `src/components/Header.jsx`: Menú de navegación principal con tab de comisiones (139 líneas).
- `src/App.jsx`: Enrutamiento y carga diferida con `React.lazy` (218 líneas).
- `src/components/CommissionSettlementView.jsx`: Vista contenedora principal (201 líneas).
- `src/components/commissions/hooks/useCommissionSettlements.js`: Hook de dominio financiero (338 líneas).
- `src/components/commissions/SellerCommissionDashboard.jsx`: Tablero vendedor (202 líneas).
- `src/components/commissions/AdminCommissionPanel.jsx`: Panel de auditoría admin (243 líneas).
- `src/components/commissions/SettlementHistoryTable.jsx`: Historial de liquidaciones (220 líneas).
- `src/components/commissions/ConfirmSettlementModal.jsx`: Modal emisión `LIQ-...` (145 líneas).
- `src/components/commissions/MarkSettlementPaidModal.jsx`: Modal desembolso bancario (164 líneas).
- `src/components/commissions/SettlementDetailReceiptModal.jsx`: Recibo imprimible (238 líneas).
- `tests/commissions/commission-frontend.test.js`: Suite de verificación frontend (45 tests, 233 líneas).
- `tests/adversarial/sprint5-commission-frontend-challenger.test.js`: Suite adversarial de estrés numérico (16 tests).
