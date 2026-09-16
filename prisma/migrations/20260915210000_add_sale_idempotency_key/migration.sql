-- AlterTable
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sales_idempotencyKey_key" ON "sales"("idempotencyKey");
