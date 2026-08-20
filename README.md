# DanNest

A small social media / collection website — built as a learning project.

Monorepo containing a **Next.js** web app, two **Spring Boot** microservices,
and one **Express/TypeScript** microservice — backed by **PostgreSQL** (one
database per Spring Boot service), **MongoDB**, **RabbitMQ**, **Redis**, and
**Cloudflare R2** (media storage).

---

## Tech stack

| Layer               | Technology                        | Location                 | Port  |
| -------------------- | --------------------------------- | ------------------------- | ----- |
| Frontend             | Next.js 16 (React 19, TypeScript) | `web/`                     | 3000  |
| Backend — Core       | Spring Boot 3.5 (Java 21, Gradle) | `services/core/`           | 8090  |
| Backend — Notification | Spring Boot 3.5 (Java 21, Gradle) | `services/notification/`   | 8091  |
| Backend — Media      | Express 4 (Node 22, TypeScript)   | `services/media/`          | 8092  |
| Database — Core       | PostgreSQL 17 (via Docker)        | `services/core/`           | 5440  |
| Database — Notification | PostgreSQL 17 (via Docker)      | `services/notification/`   | 5441  |
| Database — Media      | MongoDB 7 (via Docker)            | `services/media/`          | 27017 |
| Message broker        | RabbitMQ 4 (via Docker)           | shared, root `docker-compose.yml` | 5672 (AMQP), 15672 (UI) |
| Cache/session store    | Redis 7 (via Docker)              | shared, root `docker-compose.yml` | 6379  |

Every app/service is **independent** — its own toolchain (npm for `web/` and
`services/media/`, Gradle for the two Spring Boot backends), own deploy, own
database. None of the three backends query each other's database directly.
Core and Notification talk over RabbitMQ (Core publishes domain events,
Notification consumes them); Core and Media don't talk to each other at
all — the frontend calls each directly, and Core only ever stores a media
asset's id plus a denormalized url/crop snapshot handed to it at write time.
See [Lesson 4](docs/lessons/lesson-4-microservices.md) for the full story of
the Notification split (including a real production incident it caused and
how it was fixed) and [Architecture & flows](docs/tech/architecture-flows.md)
for the Media split's request flows.

Media uploads (post images, avatars, collection covers) live entirely in
`services/media`, backed by MongoDB (metadata) and Cloudflare R2 (bytes) —
`services/core` has no media table and no R2 credentials at all.

## Repository structure

```
.
├── web/                        # Next.js frontend (npm)
│   └── src/app/                # App Router pages
├── services/
│   ├── core/                   # Spring Boot backend — auth/user/collection/post/comment (Gradle)
│   │   ├── src/main/java/          # Java source
│   │   └── src/main/resources/
│   │       ├── application.yml            # app + DB config
│   │       └── db/migration/              # Flyway SQL migrations
│   ├── notification/           # Spring Boot backend — RabbitMQ consumer + realtime push (Gradle)
│   └── media/                  # Express/TypeScript backend — media assets (npm)
│       ├── src/                    # TypeScript source
│       └── .env.example            # copy to .env for local Mongo/R2 config
├── docker-compose.yml          # local Postgres (x2) + Mongo + RabbitMQ + Redis, shared by all services
├── infra/                      # Terraform (Infrastructure as Code) for Render
├── .github/workflows/          # CI/CD pipeline (deploy.yml)
├── docs/
│   ├── lessons/                 # learning notes, in order (monorepo, CI/CD, auth, microservices, redis)
│   └── tech/                    # technical reference (architecture + flows, DB schema)
└── README.md
```

## Prerequisites

- **Node.js** ≥ 22 and npm ≥ 10
- **Java** 21 (JDK)
- **Docker** Desktop (for Postgres ×2 + Mongo + RabbitMQ + Redis)
- (optional) VSCode with *Extension Pack for Java* + *Spring Boot Extension Pack*

## Getting started

Clone, then start the pieces in order: **infra first**, then all three backends, then the frontend.

### 1. Start infra (Postgres ×2 + Mongo + RabbitMQ + Redis, in Docker)

```bash
docker compose up -d
docker ps        # confirm postgres-core, postgres-notification, mongo-media, rabbitmq, redis are Up
```

RabbitMQ's management UI is at http://localhost:15672 (guest/guest) — handy
for watching the `dannest.events` exchange/queue while debugging.

Stop it later with:

```bash
docker compose down
```

### 2. Run Core (Spring Boot)

```bash
cd services/core
./gradlew bootRun
```

Or in VSCode/IntelliJ: click **Run** above `main()` in `DannestApplication.java`.

Verify it's healthy:

```bash
curl http://localhost:8090/actuator/health   # -> {"status":"UP"}
```

### 3. Run Notification (Spring Boot)

```bash
cd services/notification
./gradlew bootRun
```

```bash
curl http://localhost:8091/actuator/health   # -> {"status":"UP"}
```

### 4. Run Media (Express)

```bash
cd services/media
npm install      # first time only
cp .env.example .env   # fill in R2 creds to actually store uploads; Mongo/JWT already default to local
npm run dev
```

```bash
curl http://localhost:8092/healthz   # -> {"status":"ok"}
```

### 5. Run the frontend (Next.js)

```bash
cd web
npm install      # first time only
npm run dev
```

Open http://localhost:3000

## Configuration

All apps read config from environment variables with sensible local defaults,
so **no setup is needed for local dev**. Override when needed:

| Variable                | Default (local)                                       | Used by            |
| ------------------------ | ------------------------------------------------------ | ------------------- |
| `DB_URL`                 | `jdbc:postgresql://localhost:5440/dannest`              | Core                 |
| `DB_URL`                 | `jdbc:postgresql://localhost:5441/dannest_notification` | Notification         |
| `DB_USER` / `DB_PASSWORD`| `dannest` / `dannest`                                   | both backends        |
| `SERVER_PORT`            | `8090` (Core) / `8091` (Notification)                   | both backends        |
| `JWT_SECRET`             | insecure dev default (shared by both — same secret HS256-signs and verifies) | both backends |
| `JWT_ACCESS_EXPIRATION_SECONDS` | `900` (15 min)                                    | Core                 |
| `JWT_REFRESH_EXPIRATION_SECONDS`| `2592000` (30 days) — tracked in Redis, revocable  | Core                 |
| `JWT_REFRESH_COOKIE_SECURE` / `JWT_REFRESH_COOKIE_SAME_SITE` | `false` / `Lax` (local) — `true` / `None` in production (web + Core are cross-site there) | Core |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `localhost` / `6379` / _(none)_ — refresh tokens, feed cache, trending leaderboard | Core |
| `REDIS_SSL_ENABLED`      | `false` (local) — `true` in production (Upstash)         | Core                 |
| `FEED_CACHE_TTL_SECONDS` | `20` — safety-net TTL between explicit feed-cache evictions | Core |
| `RABBITMQ_HOST`          | `localhost`                                             | both backends        |
| `RABBITMQ_PORT`          | `5672` (local) — hosted brokers use `5671` + TLS         | both backends        |
| `RABBITMQ_SSL_ENABLED`   | `false` (local) — `true` in production                  | both backends        |
| `GOOGLE_CLIENT_ID`       | a committed dev-only client id (public, safe to commit) — must match the frontend's `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Core |
| `CORS_ALLOWED_ORIGINS`   | `http://localhost:3000`                                 | all three backends    |
| `MONGO_URI`              | `mongodb://localhost:27017/dannest_media`               | Media                 |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` | _(none)_ — required for media upload to actually work locally; see below | Media |
| `R2_BUCKET`              | `dannest-media`                                         | Media                 |
| `R2_PUBLIC_BASE_URL`     | _(none)_                                                | Media                 |

> Local dev credentials are intentionally simple. **Never** use these in production —
> production supplies real secrets via environment variables (see `infra/terraform.tfvars`,
> gitignored).

**Cloudflare R2 (media uploads)** doesn't have a zero-config local default like
the rest of the table — without real credentials, everything runs fine except
uploading an image. Copy `services/media/.env.example` to `services/media/.env`
(gitignored), fill in your R2 values, and `npm run dev` picks it up automatically.

**Frontend (`web/`)** reads its own env vars at *build* time, from
`web/.env.local` (gitignored, not committed):

| Variable                          | Default (local)          |
| ----------------------------------- | -------------------------- |
| `NEXT_PUBLIC_API_URL`               | `http://localhost:8090`    |
| `NEXT_PUBLIC_NOTIFICATION_API_URL`  | `http://localhost:8091`    |
| `NEXT_PUBLIC_MEDIA_API_URL`         | `http://localhost:8092`    |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`      | _(none — Google Sign-In won't work until this is set)_ |

## Database migrations

The two Spring Boot services' schemas are managed by **Flyway**, separately per
service. Add versioned SQL files to `services/core/src/main/resources/db/migration/`
or `services/notification/src/main/resources/db/migration/` named
`V1__description.sql`, `V2__...`, etc. They run automatically on that
service's startup. No two services **ever share a schema** — see
[Lesson 4](docs/lessons/lesson-4-microservices.md) for why, and
[`docs/tech/db-schema.md`](docs/tech/db-schema.md) for the current schema
itself (ER diagrams + table reference for all three databases, including
Media's schemaless MongoDB collection).

## Deployment (CI/CD + IaC)

Production runs on **Render** — four services (web, Core, Notification, Media) —
with two **Neon** Postgres databases (one per Spring Boot backend), one
**MongoDB Atlas** database (Media), a **CloudAMQP** RabbitMQ instance, and an
**Upstash** Redis instance (Core only).

- **Infrastructure as Code** — the Render services are defined in `infra/*.tf`
  (Terraform). Run `terraform apply` from `infra/` to create new ones.
- **CI/CD** — `.github/workflows/deploy.yml` runs on every push to `main`: it
  checks the changed service (build + test) and, only if green, triggers a
  Render deploy. Path filters mean **only the service that changed** is
  redeployed.
- **Free-tier gotcha** — `terraform apply` can only *create* new Render
  services; it can't push config changes (env vars, build settings) to a
  service that already exists on the free plan. Those updates go through
  Render's REST API directly instead. See
  [Lesson 4, section 5](docs/lessons/lesson-4-microservices.md#5-the-re-apply-gotcha-the-part-that-actually-broke)
  for the full story — it's a real incident this project hit.

See [`docs/lessons/lesson-2-cicd.md`](docs/lessons/lesson-2-cicd.md) for a
full, beginner-friendly explanation of the pipeline itself, and
[`docs/lessons/lesson-4-microservices.md`](docs/lessons/lesson-4-microservices.md)
for how a third service gets added to it.

## Learning notes

This is a learning project — `docs/` explains it from scratch, split into two
kinds of notes:

**Lessons** (`docs/lessons/`) — chronological, narrative "from zero" write-ups
of *why* things were built the way they were, including the mistakes:

- [Lesson 1 — Monorepo](docs/lessons/lesson-1-monorepo.md)
- [Lesson 2 — CI/CD](docs/lessons/lesson-2-cicd.md)
- [Lesson 3 — Google Auth](docs/lessons/lesson-3-google-auth.md)
- [Lesson 4 — Monolith → Microservices](docs/lessons/lesson-4-microservices.md)
- [Lesson 5 — Redis & refresh tokens](docs/lessons/lesson-5-redis-refresh-tokens.md)
- [Lesson 6 — Feed caching, a leaderboard, and a fix we didn't need](docs/lessons/lesson-6-feed-cache-and-trending.md)

**Technical reference** (`docs/tech/`) — current-state reference docs, not a
story:

- [Architecture & flows](docs/tech/architecture-flows.md) — every service
  (ours and third-party), the libraries each of ours uses, and diagrams for
  key request/event flows (login, create-post → notification, media upload/
  re-crop/delete, feed cache, trending).
- [Database schema](docs/tech/db-schema.md) — ER diagrams and table reference
  for all three databases (Core's Postgres, Notification's Postgres, Media's MongoDB).

## Roadmap

- [x] Monorepo scaffolding (web + service + Postgres)
- [x] Deployment: Render + Neon, Terraform IaC, CI/CD pipeline
- [x] Authentication (Google Sign-In + JWT)
- [x] Posts feature (entity, REST API, UI)
- [x] Comments feature (entity, REST API, UI)
- [x] Collections + follow-a-collection
- [x] Notifications, extracted into their own microservice (RabbitMQ events,
      own database, own Render deploy)
- [x] Realtime notifications over WebSocket/STOMP, with polling fallback
- [x] Redis-backed refresh tokens (short-lived JWT access token + revocable,
      rotating refresh token in an httpOnly cookie)
- [x] Media uploads (avatars, collection covers, post images) via Cloudflare
      R2, with display-time crop/framing
- [x] Media extracted into its own service (`services/media`, Express +
      MongoDB) — a deliberately different stack from the two Spring Boot
      services; Core keeps only an opaque id + denormalized url/crop snapshot
- [x] `FOLLOW` / `POST_LIKED` notifications, riding the existing RabbitMQ
      pipe (`NEW_POST`/`COMMENT_REPLY`'s track)
- [x] Redis feed cache — caches which posts belong on a page, never
      per-user data (likes/counts stay live on every request)
- [x] Trending posts leaderboard (Redis sorted set, `GET /api/v1/posts/trending`)
      — backend only; no frontend UI surfaces it yet
- [ ] Multi-instance realtime fan-out (Redis pub/sub) — built, then
      reverted: Notification runs as a single instance in production with
      no plan to change that, so the bug it fixes can't occur. Design kept
      in [Lesson 6](docs/lessons/lesson-6-feed-cache-and-trending.md) §4 for
      if that ever changes.
