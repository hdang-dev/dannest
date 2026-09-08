# Local development

Everything you need to run DanNest on your machine. The [README](../README.md)
has the 5-line version; this is the full reference.

## Prerequisites

- **Node.js** ≥ 22 and npm ≥ 10
- **Java** 21 (JDK)
- **Docker** Desktop — runs Postgres ×2 + RabbitMQ + Redis
- **MongoDB** — either a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
  or a local `mongod` (the marketplace service needs one; it isn't in `docker-compose.yml`)
- (optional) VSCode with *Extension Pack for Java* + *Spring Boot Extension Pack*

## Start order

**Infra first**, then the three backends, then the frontend.

### 1. Infra (Docker)

```bash
docker compose up -d
docker ps        # postgres-core, postgres-notification, rabbitmq, redis → Up
```

RabbitMQ's management UI is at http://localhost:15672 (guest/guest) — useful for
watching the `dannest.events` exchange and the saga queues while debugging.

```bash
docker compose down   # stop later
```

### 2. Core (Spring Boot, :8090)

```bash
cd services/core
./gradlew bootRun
curl http://localhost:8090/actuator/health   # -> {"status":"UP"}
```

Boots with no extra config. Only **image uploads** need Cloudflare R2 — copy
`services/core/src/main/resources/application-local.yml.example` to
`application-local.yml` (gitignored) and fill in your R2 values; `./gradlew
bootRun` activates the `local` profile and picks it up.

### 3. Notification (Spring Boot, :8091)

```bash
cd services/notification
./gradlew bootRun
curl http://localhost:8091/actuator/health   # -> {"status":"UP"}
```

### 4. Marketplace (Node + TypeScript, :8092)

```bash
cd services/marketplace
npm install
npm run dev
curl http://localhost:8092/healthz           # -> {"status":"ok"}
```

Boots with no config for everything except **payments**. To exercise the
membership saga you need Stripe test-mode keys (see *Stripe setup* below) and a
`MONGO_URI` pointing at your Atlas cluster or local `mongod`.

### 5. Frontend (Next.js, :3000)

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000

## Environment variables

All services read config from environment variables with local defaults, so
**nothing is required for local social-feature dev**. Override as needed.

### Core & Notification (Spring Boot)

| Variable | Default (local) | Used by |
| --- | --- | --- |
| `DB_URL` | `jdbc:postgresql://localhost:5440/dannest` | Core |
| `DB_URL` | `jdbc:postgresql://localhost:5441/dannest_notification` | Notification |
| `DB_USER` / `DB_PASSWORD` | `dannest` / `dannest` | both |
| `SERVER_PORT` | `8090` (Core) / `8091` (Notification) | both |
| `JWT_SECRET` | insecure dev default — same secret HS256-signs (Core) and verifies (all) | all backends |
| `JWT_ACCESS_EXPIRATION_SECONDS` | `900` (15 min) | Core |
| `JWT_REFRESH_EXPIRATION_SECONDS` | `2592000` (30 days) — tracked in Redis, revocable | Core |
| `JWT_REFRESH_COOKIE_SECURE` / `JWT_REFRESH_COOKIE_SAME_SITE` | `false` / `Lax` local — `true` / `None` in prod | Core |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `localhost` / `6379` / _(none)_ | Core |
| `REDIS_SSL_ENABLED` | `false` local — `true` in prod (Upstash) | Core |
| `FEED_CACHE_TTL_SECONDS` | `20` | Core |
| `RABBITMQ_HOST` / `RABBITMQ_PORT` | `localhost` / `5672` (prod: `5671` + TLS) | both |
| `RABBITMQ_SSL_ENABLED` | `false` local — `true` in prod | both |
| `GOOGLE_CLIENT_ID` | committed dev-only client id (public) — must match the frontend's | Core |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | both |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` | _(none)_ — required for uploads | Core |
| `R2_BUCKET` / `R2_PUBLIC_BASE_URL` | `dannest-media` / _(none)_ | Core |

### Marketplace (Node)

| Variable | Default (local) | Notes |
| --- | --- | --- |
| `PORT` | `8092` | |
| `MONGO_URI` | `mongodb://localhost:27017/dannest_marketplace` | Atlas `mongodb+srv://…` in prod |
| `JWT_SECRET` | same insecure dev default as the Spring services | verifies the same JWTs Core issues |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | single URL, not the Core-style split vars |
| `STRIPE_SECRET_KEY` | _(none)_ | `sk_test_…` — everything payment-related needs this |
| `STRIPE_PUBLISHABLE_KEY` | _(none)_ | `pk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | _(none)_ | `whsec_…` — from `stripe listen` locally |
| `STRIPE_CONNECT_REFRESH_URL` | `http://localhost:3000/profile` | Stripe onboarding bounce-back |
| `STRIPE_CONNECT_RETURN_URL` | `http://localhost:3000/profile?connected=1` | |

### Frontend (`web/`)

Read at **build** time from `web/.env.local` (gitignored):

| Variable | Default (local) |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8090` |
| `NEXT_PUBLIC_NOTIFICATION_API_URL` | `http://localhost:8091` |
| `NEXT_PUBLIC_MARKETPLACE_API_URL` | `http://localhost:8092` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | _(none — Google Sign-In won't work until set)_ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | _(none — the checkout card form won't load until set)_ `pk_test_…` |

> Local dev credentials are intentionally simple. **Never** use them in
> production — prod supplies real secrets via env vars (`infra/terraform.tfvars`,
> gitignored).

## Stripe setup (membership saga)

The marketplace's payment flow needs Stripe running in **test mode**:

1. Create a free [Stripe account](https://dashboard.stripe.com/register), stay in
   **Test mode** (toggle, top-right). No business verification needed for test mode.
2. From the Developers → API keys page, copy the **secret** (`sk_test_…`) and
   **publishable** (`pk_test_…`) keys into `STRIPE_SECRET_KEY` /
   `STRIPE_PUBLISHABLE_KEY` (marketplace) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (web).
3. Enable **Connect** (Dashboard → Connect → Get started) so the service can
   create Express accounts for creators.
4. Forward webhooks to the local marketplace:
   ```bash
   stripe login
   stripe listen --forward-to localhost:8092/api/v1/marketplace/stripe/webhook
   ```
   Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`.
5. Test cards: `4242 4242 4242 4242` (any future expiry / any CVC) for a
   successful charge; `4000 0000 0000 0002` for a decline. To onboard a creator's
   Connect account, use Stripe's test onboarding — every field accepts test data.

## Database migrations

The two Spring services' schemas are managed by **Flyway**, separately per
service — versioned SQL in
`services/<core|notification>/src/main/resources/db/migration/` named
`V1__description.sql`, `V2__…`. They run on that service's startup. No two
services ever share a schema.

The marketplace service uses **Mongoose** — collections and indexes are declared
in the schema files under `services/marketplace/src/**/` and created on connect;
there are no migration files.

Current schema for all four databases: [docs/tech/db-schema.md](tech/db-schema.md).
