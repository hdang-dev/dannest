# syntax=docker/dockerfile:1
# =============================================================================
#  DanNest Web — multi-stage Docker build (Next.js)
#
#  Stage 1 (build) installs all deps and runs `next build`.
#  Stage 2 (run)   installs only prod deps and runs `next start` against the
#                   build output from stage 1.
# =============================================================================


# ------------------------------- Stage 1: build ------------------------------
# NOT node:22-alpine: Next.js 16.2.10's Turbopack fails to resolve next/font/google
# CSS modules on Alpine's musl libc ("module not found" on the generated font
# CSS, even though the font itself fetches fine over the network) — reproduced
# and confirmed by building on plain node:22 (glibc) instead, which works.
FROM node:22 AS build
WORKDIR /app

# NEXT_PUBLIC_* vars are read at BUILD time and baked into the bundle, so they
# must be passed as build args (they're not secrets — they end up in client JS).
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_NOTIFICATION_API_URL
ARG NEXT_PUBLIC_MARKETPLACE_API_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_NOTIFICATION_API_URL=$NEXT_PUBLIC_NOTIFICATION_API_URL \
    NEXT_PUBLIC_MARKETPLACE_API_URL=$NEXT_PUBLIC_MARKETPLACE_API_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


# -------------------------------- Stage 2: run -------------------------------
# Same glibc base as the build stage, for consistency — this stage only runs
# `next start` against an already-built app, so it may not strictly need it,
# but it wasn't separately verified on alpine and there's no size pressure
# forcing the risk.
FROM node:22 AS run
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./

EXPOSE 3000

# Binds to $PORT when the host provides one (Render does), otherwise 3000 for local runs.
ENTRYPOINT ["sh", "-c", "npm start -- -p ${PORT:-3000}"]
