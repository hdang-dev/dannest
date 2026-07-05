# DanNest

A small social media / collection website — built as a learning project.

Monorepo containing a **Next.js** web app and a **Spring Boot** API, backed by **PostgreSQL**.

---

## Tech stack

| Layer     | Technology                        | Location   | Port |
| --------- | --------------------------------- | ---------- | ---- |
| Frontend  | Next.js 16 (React 19, TypeScript) | `web/`     | 3000 |
| Backend   | Spring Boot 3.5 (Java 21, Gradle) | `service/` | 8090 |
| Database  | PostgreSQL 17 (via Docker)        | `service/` | 5440 |

Frontend and backend are **independent apps** in one repo, each with its own
toolchain (npm for `web/`, Gradle for `service/`). They talk over HTTP/JSON.

## Repository structure

```
.
├── web/                        # Next.js frontend (npm)
│   └── src/app/                # App Router pages
├── service/                    # Spring Boot backend (Gradle)
│   ├── src/main/java/          # Java source
│   ├── src/main/resources/
│   │   ├── application.yml      # app + DB config
│   │   └── db/migration/        # Flyway SQL migrations
│   └── docker-compose.yml       # local Postgres
└── README.md
```

## Prerequisites

- **Node.js** ≥ 22 and npm ≥ 10
- **Java** 21 (JDK)
- **Docker** Desktop (for Postgres)
- (optional) VSCode with *Extension Pack for Java* + *Spring Boot Extension Pack*

## Getting started

Clone, then start the three pieces. Order matters: **database first**, then backend, then frontend.

### 1. Start the database (Postgres in Docker)

```bash
docker compose -f service/docker-compose.yml up -d
docker ps        # confirm "dannest-postgres" is Up on 5440
```

Stop it later with:

```bash
docker compose -f service/docker-compose.yml down
```

### 2. Run the backend (Spring Boot)

```bash
cd service
./gradlew bootRun
```

Or in VSCode/IntelliJ: click **Run** above `main()` in `DannestApplication.java`.

Verify it's healthy (and connected to Postgres):

```bash
curl http://localhost:8090/actuator/health   # -> {"status":"UP"}
```

### 3. Run the frontend (Next.js)

```bash
cd web
npm install      # first time only
npm run dev
```

Open http://localhost:3000

## Configuration

Both apps read config from environment variables with sensible local defaults,
so **no setup is needed for local dev**. Override when needed:

| Variable      | Default (local)                              | Used by  |
| ------------- | -------------------------------------------- | -------- |
| `DB_URL`      | `jdbc:postgresql://localhost:5440/dannest`   | backend  |
| `DB_USER`     | `dannest`                                    | backend  |
| `DB_PASSWORD` | `dannest`                                    | backend  |
| `SERVER_PORT` | `8090`                                       | backend  |

> Local dev credentials are intentionally simple. **Never** use these in production —
> production supplies real secrets via environment variables.

## Database migrations

Schema is managed by **Flyway**. Add versioned SQL files to
`service/src/main/resources/db/migration/` named `V1__description.sql`,
`V2__...`, etc. They run automatically on backend startup.

## Roadmap

- [x] Monorepo scaffolding (web + service + Postgres)
- [ ] Posts feature (entity, REST API, UI)
- [ ] Authentication (users + JWT)
- [ ] CI (GitHub Actions)
