-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "balanceDue" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "commissionPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "commissionSettlementId" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "deliveryMethod" TEXT NOT NULL DEFAULT 'PUNTO_VENTA',
ADD COLUMN     "depositAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "orderType" TEXT NOT NULL DEFAULT 'POS_FERIA',
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'PAGADO_TOTAL',
ADD COLUMN     "pickupEventId" TEXT,
ADD COLUMN     "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "shippingCourier" TEXT,
ADD COLUMN     "shippingTrackingNumber" TEXT;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "customDimensions" TEXT,
ADD COLUMN     "customImageUrl" TEXT,
ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "material" TEXT,
ADD COLUMN     "printSheetId" TEXT;

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "deliveryAddress" TEXT,
    "department" TEXT,
    "municipality" TEXT,
    "sourceChannel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_sheets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sheetCode" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    "notes" TEXT,
    "createdById" TEXT,
    "printedById" TEXT,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_settlements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "totalProductsAmount" DECIMAL(10,2) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    "totalCommission" DECIMAL(10,2) NOT NULL,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_sessions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
    "eventId" TEXT,
    "sellerName" TEXT,
    "pendingDraft" JSONB,
    "messagesHistory" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_tenantId_fullName_idx" ON "customers"("tenantId", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenantId_phone_key" ON "customers"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "print_sheets_tenantId_status_idx" ON "print_sheets"("tenantId", "status");

-- CreateIndex
CREATE INDEX "print_sheets_sheetCode_idx" ON "print_sheets"("sheetCode");

-- CreateIndex
CREATE INDEX "commission_settlements_tenantId_sellerId_idx" ON "commission_settlements"("tenantId", "sellerId");

-- CreateIndex
CREATE INDEX "commission_settlements_status_idx" ON "commission_settlements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_sessions_sessionId_key" ON "ai_chat_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_tenantId_eventId_idx" ON "ai_chat_sessions"("tenantId", "eventId");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_tenantId_idx" ON "ai_chat_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_eventId_idx" ON "ai_chat_sessions"("eventId");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_updatedAt_idx" ON "ai_chat_sessions"("updatedAt");

-- CreateIndex
CREATE INDEX "sales_orderType_idx" ON "sales"("orderType");

-- CreateIndex
CREATE INDEX "sales_customerId_idx" ON "sales"("customerId");

-- CreateIndex
CREATE INDEX "sales_paymentStatus_idx" ON "sales"("paymentStatus");

-- CreateIndex
CREATE INDEX "sales_commissionSettlementId_idx" ON "sales"("commissionSettlementId");

-- CreateIndex
CREATE INDEX "sale_items_printSheetId_idx" ON "sale_items"("printSheetId");

-- CreateIndex
CREATE INDEX "sale_items_isCustom_idx" ON "sale_items"("isCustom");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_settlements" ADD CONSTRAINT "commission_settlements_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_settlements" ADD CONSTRAINT "commission_settlements_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_pickupEventId_fkey" FOREIGN KEY ("pickupEventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_commissionSettlementId_fkey" FOREIGN KEY ("commissionSettlementId") REFERENCES "commission_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_printSheetId_fkey" FOREIGN KEY ("printSheetId") REFERENCES "print_sheets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
