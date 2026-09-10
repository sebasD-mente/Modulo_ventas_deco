# =============================================================================
#  Dockerfile — Deko EventSales (Production Multi-Stage Build)
#  Target Platform: Dokploy / Docker Engine (Debian Bookworm glibc)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies & Prisma Client Generation
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps

WORKDIR /app

# Install OpenSSL & CA certificates needed by Prisma CLI and native engines
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build tools and Prisma CLI)
RUN npm ci

# Generate Prisma Client for target platforms (native and debian-openssl-3.0.x)
RUN npx prisma generate

# -----------------------------------------------------------------------------
# Stage 2: Frontend Asset Builder
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Reuse dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Copy frontend source and configuration files
COPY index.html ./
COPY vite.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY src ./src/
COPY public ./public/

# Compile optimized production SPA bundle into dist/
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Production Runner
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Install runtime OpenSSL and CA certificates for Prisma Engine in Debian Bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy runtime node_modules (including Prisma binaries and generated client)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY package*.json ./

# Copy compiled frontend distribution from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend server source
COPY server ./server

# Copy static assets (e.g. public/uploads/.gitkeep)
COPY public ./public

# Copy container entrypoint script and ensure executable permissions (stripping CRLF if present)
COPY entrypoint.sh ./entrypoint.sh
RUN sed -i 's/\r$//' ./entrypoint.sh && chmod +x ./entrypoint.sh

# Expose HTTP service port
EXPOSE 3001

# Define container entrypoint and default command
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server/index.js"]
