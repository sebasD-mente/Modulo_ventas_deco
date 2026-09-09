# =============================================================================
#  Dockerfile — Deko EventSales (Producción Dokploy / VPS)
# =============================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

# Copiar código fuente y compilar bundle frontend
COPY . .
RUN npm run build

# Etapa 2: Servidor en Producción
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

# Copiar binarios y esquemas de Prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Copiar bundle de distribución y código del servidor
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server/index.js"]
