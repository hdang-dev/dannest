# syntax=docker/dockerfile:1
# =============================================================================
#  DanNest Marketplace service — multi-stage Docker build (TypeScript -> JS)
#
#  Stage 1 (build) installs dev deps and compiles src/ to dist/ with tsc.
#  Stage 2 (run)   installs only prod deps and runs the compiled dist/.
# =============================================================================


# ------------------------------- Stage 1: build ------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build


# -------------------------------- Stage 2: run -------------------------------
FROM node:22-alpine AS run
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 8092

# Binds to $PORT when the host provides one (Render does), otherwise 8092 for local runs.
CMD ["node", "dist/server.js"]
