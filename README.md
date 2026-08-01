# DanNest

A small social media / collection website — built as a learning project.

Monorepo containing a **Next.js** web app and two **Spring Boot** microservices,
backed by **PostgreSQL** (one database per service) and **RabbitMQ**.

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

Every app/service is **independent** — its own toolchain (npm for `web/`,
Gradle for each backend), own deploy, own database. Core and Notification
never query each other's database directly; Core publishes domain events to
RabbitMQ and Notification consumes them, decoupled and independently
deployable. See [Lesson 4](docs/lesson-4-microservices.md) for the full story
of that split, including a real production incident it caused and how it was
fixed.

`services/media` is a planned future service (not built yet) for file
uploads, following the same pattern.

## Repository structure

```
.
├── web/                        # Next.js frontend (npm)
│   └── src/app/                # App Router pages
├── services/
│   ├── core/                   # Spring Boot backend — auth/user/collection/post/comment (Gradle)
│   │   ├── src/main/java/          # Java source
│   │   └── src/main/resources/
│   │       ├── application.yml      # app + DB config
│   │       └── db/migration/        # Flyway SQL migrations
│   └── notification/           # Spring Boot backend — RabbitMQ consumer + realtime push (Gradle)
├── docker-compose.yml          # local Postgres (x2) + RabbitMQ, shared by all services
├── infra/                      # Terraform (Infrastructure as Code) for Render
├── .github/workflows/          # CI/CD pipeline (deploy.yml)
├── docs/                       # learning notes (monorepo, CI/CD, auth, microservices)
└── README.md
```

## Prerequisites

- **Node.js** ≥ 22 and npm ≥ 10
- **Java** 21 (JDK)
- **Docker** Desktop (for Postgres ×2 + RabbitMQ)
- (optional) VSCode with *Extension Pack for Java* + *Spring Boot Extension Pack*

## Getting started

Clone, then start the pieces in order: **infra first**, then both backends, then the frontend.

### 1. Start infra (Postgres ×2 + RabbitMQ, in Docker)

```bash
docker compose up -d
docker ps        # confirm postgres-core, postgres-notification, rabbitmq are Up
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
| `RABBITMQ_HOST`          | `localhost`                                             | both backends        |
| `RABBITMQ_PORT`          | `5672` (local) — hosted brokers use `5671` + TLS         | both backends        |
| `RABBITMQ_SSL_ENABLED`   | `false` (local) — `true` in production                  | both backends        |

> Local dev credentials are intentionally simple. **Never** use these in production —
> production supplies real secrets via environment variables (see `infra/terraform.tfvars`,
> gitignored).

## Database migrations

Schema is managed by **Flyway**, separately per service. Add versioned SQL
files to `services/core/src/main/resources/db/migration/` or
`services/notification/src/main/resources/db/migration/` named
`V1__description.sql`, `V2__...`, etc. They run automatically on that
service's startup. The two services **never share a schema** — see
[Lesson 4](docs/lesson-4-microservices.md) for why.

## Deployment (CI/CD + IaC)

Production runs on **Render** — three services (web, Core, Notification) —
with two **Neon** Postgres databases (one per backend) and a **CloudAMQP**
RabbitMQ instance.

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
  [Lesson 4, section 5](docs/lesson-4-microservices.md#5-the-re-apply-gotcha-the-part-that-actually-broke)
  for the full story — it's a real incident this project hit.

See [`docs/lesson-2-cicd.md`](docs/lesson-2-cicd.md) for a full, beginner-friendly
explanation of the pipeline itself, and
[`docs/lesson-4-microservices.md`](docs/lesson-4-microservices.md) for how a
third service gets added to it.

## Learning notes

This is a learning project — the `docs/` folder explains it from scratch:

- [Lesson 1 — Monorepo](docs/lesson-1-monorepo.md)
- [Lesson 2 — CI/CD](docs/lesson-2-cicd.md)
- [Lesson 3 — Google Auth](docs/lesson-3-google-auth.md)
- [Lesson 4 — Monolith → Microservices](docs/lesson-4-microservices.md)

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
- [ ] Media service (file uploads), following the same service-boundary pattern
- [ ] Redis (caching, and pub/sub for realtime once Notification runs on
      more than one instance)
