# Stage 1: Build Frontend Web (Vite + React)
FROM node:22-alpine AS frontend-builder
WORKDIR /app/Frontend_Web
COPY Frontend_Web/package*.json ./
RUN npm ci
COPY Frontend_Web/ ./
RUN npm run build

# Stage 2: Production Full-stack Runtime (Express API + Static Web)
FROM node:22-alpine AS production
WORKDIR /app

# Copy Backend dependencies
COPY Backend/package*.json ./Backend/
WORKDIR /app/Backend
RUN npm ci --omit=dev

# Copy Backend source code
COPY Backend/ ./

# Copy Frontend production build from Stage 1
COPY --from=frontend-builder /app/Frontend_Web/dist /app/Frontend_Web/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["sh", "-c", "node scripts/init_cloud_db.js && node src/server.js"]
