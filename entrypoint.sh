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

# 2. Automated Schema Migration / Push (Safe Execution without Data Loss)
echo "🔄 [Entrypoint] Synchronizing database schema with Prisma..."
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "📦 [Entrypoint] Migrations directory detected. Executing 'prisma migrate deploy'..."
  npx --no-install prisma migrate deploy || {
    echo "⚠️ [Entrypoint] Migration deploy encountered conflict. Resolving baseline..."
    npx --no-install prisma migrate resolve --applied 20260913000000_init_stand_ia || true
    npx --no-install prisma migrate deploy || npx --no-install prisma db push --skip-generate
  }
else
  echo "📦 [Entrypoint] No migrations directory detected. Executing safe 'prisma db push --skip-generate'..."
  npx --no-install prisma db push --skip-generate
fi
echo "✅ [Entrypoint] Database schema synchronized successfully."

# 3. Master Data Verification (Fast Check + Non-blocking Seed)
echo "🌱 [Entrypoint] Checking master data (tenant and active event)..."
if node --input-type=module -e '
  import { PrismaClient } from "@prisma/client";
  const prisma = new PrismaClient();
  try {
    const t = await prisma.tenant.findUnique({ where: { slug: "deco-vintage-guate" }, select: { id: true } });
    const e = await prisma.event.findUnique({ where: { id: "evt-ventas-redes-online" }, select: { id: true } });
    await prisma.$disconnect();
    process.exit(t && e ? 0 : 1);
  } catch {
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
' > /dev/null 2>&1; then
  echo "⚡ [Entrypoint] Master data already initialized. Running lightweight background verification..."
  SKIP_WEB_SYNC=true node prisma/seed.js &
else
  SKIP_WEB_SYNC=true node prisma/seed.js
fi
echo "✅ [Entrypoint] Master data check completed."

# 4. Pass PID 1 execution to Node application
echo "🚀 [Entrypoint] Launching application process: $@"
exec "$@"
