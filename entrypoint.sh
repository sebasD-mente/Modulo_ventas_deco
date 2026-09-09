#!/bin/sh
set -e

# =============================================================================
#  entrypoint.sh — Deko EventSales (Production Container Lifecycle)
# =============================================================================

echo "======================================================================"
echo "🚀 [Deko EventSales] Starting container entrypoint initialization"
echo "======================================================================"

# 1. PostgreSQL Connectivity Check & Retry Loop
echo "⏳ [Entrypoint] Checking PostgreSQL database connectivity..."

MAX_RETRIES=${DATABASE_MAX_RETRIES:-30}
RETRY_INTERVAL=${DATABASE_RETRY_INTERVAL:-2}
ATTEMPT=1
CONNECTED=0

while [ "$ATTEMPT" -le "$MAX_RETRIES" ]; do
  if node --input-type=module -e '
    import { PrismaClient } from "@prisma/client";
    const prisma = new PrismaClient();
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      await prisma.$disconnect().catch(() => {});
      process.exit(1);
    }
  ' > /dev/null 2>&1; then
    CONNECTED=1
    break
  fi

  echo "⏳ [Entrypoint] Database not ready yet (attempt $ATTEMPT/$MAX_RETRIES). Retrying in ${RETRY_INTERVAL}s..."
  ATTEMPT=$((ATTEMPT + 1))
  sleep "$RETRY_INTERVAL"
done

if [ "$CONNECTED" -eq 1 ]; then
  echo "✅ [Entrypoint] PostgreSQL connection established successfully."
else
  echo "❌ [Entrypoint] Error: Could not connect to PostgreSQL after $MAX_RETRIES attempts."
  exit 1
fi

# 2. Automated Schema Migration / Push & Initial Seed
echo "🔄 [Entrypoint] Synchronizing database schema with Prisma (db push)..."
npx prisma db push --skip-generate
echo "✅ [Entrypoint] Prisma schema synchronization completed."

echo "🌱 [Entrypoint] Checking and seeding master data (tenant, active event, users)..."
node prisma/seed.js || true
echo "✅ [Entrypoint] Master data check completed."

# 3. Pass PID 1 execution to Node application
echo "🚀 [Entrypoint] Launching application process: $@"
exec "$@"
