# DanNest

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-6DB33F?logo=spring-boot&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?logo=rabbitmq&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-7B42BC?logo=terraform&logoColor=white)

A full-stack social media platform, built solo from scratch as a deep dive
into production-style backend architecture — microservices, event-driven
notifications, caching, and infrastructure-as-code — not just another CRUD
tutorial app.

**Live demo:** https://dannest-punh.onrender.com/ — *currently suspended, Render free-tier usage cap, resets in a few days.*

## Highlights

- **Microservices with a real reason, not resume-driven design** — two independently deployable Spring Boot services, each owning its own database, talking only through an event bus — never a direct backend-to-backend call. (A third service, media, was split out and later folded back in — [Lesson 7](docs/lessons/lesson-7-remerging-media.md) — because the split stopped paying for itself.)
- **Event-driven notifications** — the core service publishes domain events to RabbitMQ; a dedicated notification service consumes them and pushes updates live over WebSocket (STOMP).
- **Caching that's load-bearing, not decorative** — Redis-backed feed pagination cache plus a sorted-set trending leaderboard, both serving real read traffic.
- **Deployed for real, not just running on localhost** — Terraform-provisioned infrastructure on Render, GitHub Actions CI/CD building per-service Docker images to GHCR, SHA-pinned deploys with one-click rollback.
- **Documented like production software** — every non-obvious decision (including a real production incident and its fix) is written up in [docs/lessons](docs/lessons/) instead of left implicit in code.

Monorepo containing a **Next.js** web app and two **Spring Boot** microservices —
backed by **PostgreSQL** (one database per service), **RabbitMQ**, **Redis**, and
**Cloudflare R2** (media storage).

---

## Tech stack

| Layer               | Technology                        | Location                 | Port  |
| -------------------- | --------------------------------- | ------------------------- | ----- |
| Frontend             | Next.js 16 (React 19, TypeScript) | `web/`                     | 3000  |
| Backend — Core       | Spring Boot 3.5 (Java 21, Gradle) | `services/core/`           | 8090  |
| Backend — Notification | Spring Boot 3.5 (Java 21, Gradle) | `services/notification/`   | 8091  |
| Database — Core       | PostgreSQL 17 (via Docker)        | `services/core/`           | 5440  |
| Database — Notification | PostgreSQL 17 (via Docker)      | `services/notification/`   | 5441  |
| Message broker        | RabbitMQ 4 (via Docker)           | shared, root `docker-compose.yml` | 5672 (AMQP), 15672 (UI) |
| Cache/session store    | Redis 7 (via Docker)              | shared, root `docker-compose.yml` | 6379  |

Every service is **independent** — its own deploy, its own database. The two
backends never query each other's database directly: Core and Notification talk
over RabbitMQ (Core publishes domain events, Notification consumes them). See
[Lesson 4](docs/lessons/lesson-4-microservices.md) for the full story of the
Notification split (including a real production incident it caused and how it was
fixed), and [Lesson 7](docs/lessons/lesson-7-remerging-media.md) for why media —
briefly its own service — was folded back into Core.

Media uploads (post images, avatars, collection covers) live in `services/core`:
metadata in its Postgres `media` table, image bytes in Cloudflare R2 (via the S3
API). Core is the only service with R2 credentials.

## Repository structure

```
.
├── web/                        # Next.js frontend (npm)
│   └── src/app/                # App Router pages
├── services/
│   ├── core/                   # Spring Boot backend — auth/user/collection/post/comment/media (Gradle)
│   │   ├── src/main/java/          # Java source
│   │   └── src/main/resources/
│   │       ├── application.yml            # app + DB config
│   │       ├── application-local.yml.example  # copy to application-local.yml for local R2 creds
│   │       └── db/migration/              # Flyway SQL migrations
│   └── notification/           # Spring Boot backend — RabbitMQ consumer + realtime push (Gradle)
├── docker-compose.yml          # local Postgres (x2) + RabbitMQ + Redis, shared by both services
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
- **Docker** Desktop (for Postgres ×2 + RabbitMQ + Redis)
- (optional) VSCode with *Extension Pack for Java* + *Spring Boot Extension Pack*

## Getting started

Clone, then start the pieces in order: **infra first**, then both backends, then the frontend.

### 1. Start infra (Postgres ×2 + RabbitMQ + Redis, in Docker)

```bash
docker compose up -d
docker ps        # confirm postgres-core, postgres-notification, rabbitmq, redis are Up
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

Core boots fine with no extra config; only **image uploads** need Cloudflare R2
credentials. To enable them locally, copy
`services/core/src/main/resources/application-local.yml.example` to
`application-local.yml` (gitignored) and fill in your R2 values — `./gradlew
bootRun` activates the `local` profile and picks it up automatically.

### 3. Run Notification (Spring Boot)

```bash
cd services/notification
./gradlew bootRun
```

```bash
curl http://localhost:8091/actuator/health   # -> {"status":"UP"}
```

### 4. Run the frontend (Next.js)

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
| `CORS_ALLOWED_ORIGINS`   | `http://localhost:3000`                                 | both backends         |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` | _(none)_ — required for media upload to actually work locally; see below | Core |
| `R2_BUCKET`              | `dannest-media`                                         | Core                  |
| `R2_PUBLIC_BASE_URL`     | _(none)_                                                | Core                  |

> Local dev credentials are intentionally simple. **Never** use these in production —
> production supplies real secrets via environment variables (see `infra/terraform.tfvars`,
> gitignored).

**Cloudflare R2 (media uploads)** doesn't have a zero-config local default like
the rest of the table — without real credentials, Core runs fine except for
uploading an image. Copy
`services/core/src/main/resources/application-local.yml.example` to
`application-local.yml` (gitignored), fill in your R2 values, and `./gradlew
bootRun` picks it up via the `local` profile. (Production sets the `R2_*` env
vars instead.)

**Frontend (`web/`)** reads its own env vars at *build* time, from
`web/.env.local` (gitignored, not committed):

| Variable                          | Default (local)          |
| ----------------------------------- | -------------------------- |
| `NEXT_PUBLIC_API_URL`               | `http://localhost:8090`    |
| `NEXT_PUBLIC_NOTIFICATION_API_URL`  | `http://localhost:8091`    |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`      | _(none — Google Sign-In won't work until this is set)_ |

## Database migrations

The two Spring Boot services' schemas are managed by **Flyway**, separately per
service. Add versioned SQL files to `services/core/src/main/resources/db/migration/`
or `services/notification/src/main/resources/db/migration/` named
`V1__description.sql`, `V2__...`, etc. They run automatically on that
service's startup. No two services **ever share a schema** — see
[Lesson 4](docs/lessons/lesson-4-microservices.md) for why, and
[`docs/tech/db-schema.md`](docs/tech/db-schema.md) for the current schema
itself (ER diagrams + table reference for both Postgres databases).

## Deployment (CI/CD + IaC)

Production runs on **Render** — three services (web, Core, Notification) — with
two **Neon** Postgres databases (one per Spring Boot backend), a **CloudAMQP**
RabbitMQ instance, an **Upstash** Redis instance (Core only), and a **Cloudflare
R2** bucket for media (Core only).

- **Infrastructure as Code** — the Render services are defined in `infra/*.tf`
  (Terraform). Run `terraform apply` from `infra/` to create new ones.
- **CI/CD** — `.github/workflows/deploy.yml` runs on every push to `main`: for
  each changed service it checks (build + test), then builds a Docker image
  and pushes it to **GHCR** (`ghcr.io/<owner>/<service>:<git-sha>`) — only if
  the checks passed — then tells Render to deploy that exact image. Render
  never builds from source; it only pulls and runs the image GitHub Actions
  built. Path filters mean **only the service that changed** goes through
  this.
- **Free-tier gotcha** — `terraform apply` can only *create* new Render
  services; it can't push config changes (env vars, build settings, or the
  git-build → image-deploy switch) to a service that already exists on the
  free plan. Those updates go through Render's REST API or dashboard
  directly instead. See
  [Lesson 4, section 5](docs/lessons/lesson-4-microservices.md#5-the-re-apply-gotcha-the-part-that-actually-broke)
  for the full story — it's a real incident this project hit.
- **Rollback** — `.github/workflows/rollback.yml` (manual `workflow_dispatch`)
  rolls one service back to a previous deploy via Render's rollback API. Safe
  because every image is tagged with an immutable commit SHA, never `latest`.

See [`docs/lessons/lesson-2-cicd.md`](docs/lessons/lesson-2-cicd.md) for a
full, beginner-friendly explanation of the pipeline itself,
[`docs/lessons/lesson-4-microservices.md`](docs/lessons/lesson-4-microservices.md)
for how a service gets added to it, and
[`docs/lessons/lesson-7-remerging-media.md`](docs/lessons/lesson-7-remerging-media.md)
for how one gets removed.

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
- [Lesson 7 — Folding media back into Core](docs/lessons/lesson-7-remerging-media.md)

**Technical reference** (`docs/tech/`) — current-state reference docs, not a
story:

- [Architecture & flows](docs/tech/architecture-flows.md) — every service
  (ours and third-party), the libraries each of ours uses, and diagrams for
  key request/event flows (login, create-post → notification, media upload/
  re-crop/delete, feed cache, trending).
- [Database schema](docs/tech/db-schema.md) — ER diagrams and table reference
  for both Postgres databases (Core's and Notification's).

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
      MongoDB), then folded back into Core once the split stopped paying for
      itself — [Lesson 7](docs/lessons/lesson-7-remerging-media.md)
- [x] `FOLLOW` / `POST_LIKED` notifications, riding the existing RabbitMQ
      pipe (`NEW_POST`/`COMMENT_REPLY`'s track)
- [x] Redis feed cache — caches which posts belong on a page, never
      per-user data (likes/counts stay live on every request)
- [x] Trending posts leaderboard (Redis sorted set, `GET /api/v1/posts/trending`),
      its own `/trending` page — a deliberately separate surface from the home
      feed, which stays newest-first and unaffected by likes/comments
- [ ] Multi-instance realtime fan-out (Redis pub/sub) — built, then
      reverted: Notification runs as a single instance in production with
      no plan to change that, so the bug it fixes can't occur. Design kept
      in [Lesson 6](docs/lessons/lesson-6-feed-cache-and-trending.md) §4 for
      if that ever changes.
