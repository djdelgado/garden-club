# ── Builder stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Build-time env vars for NEXT_PUBLIC_* (baked into client bundle by next build)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_IMAGES_URL
ARG NEXT_PUBLIC_AWS_REGION=us-east-1
ARG NEXT_PUBLIC_GOCNITO_USER_POOL_ID
ARG NEXT_PUBLIC_GOCNITO_CLIENT_ID

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_IMAGES_URL=$NEXT_PUBLIC_IMAGES_URL \
    NEXT_PUBLIC_AWS_REGION=$NEXT_PUBLIC_AWS_REGION \
    NEXT_PUBLIC_GOCNITO_USER_POOL_ID=$NEXT_PUBLIC_GOCNITO_USER_POOL_ID \
    NEXT_PUBLIC_GOCNITO_CLIENT_ID=$NEXT_PUBLIC_GOCNITO_CLIENT_ID

# Install dependencies from monorepo root (honours workspaces)
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace=frontend

# Copy frontend source and build
COPY frontend ./frontend
RUN cd frontend && npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# standalone output bundles only what next start needs (~150 MB vs ~600 MB)
# Note: .next/standalone contains nested frontend/ directory (monorepo artifact)
COPY --from=builder /app/frontend/.next/standalone/frontend ./frontend
COPY --from=builder /app/frontend/.next/standalone/node_modules ./node_modules
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "frontend/server.js"]
