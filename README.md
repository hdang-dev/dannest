# DanNest

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-6DB33F?logo=spring-boot&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-5FA04E?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?logo=rabbitmq&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?logo=stripe&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-7B42BC?logo=terraform&logoColor=white)

A full-stack social platform where creators publish collections of posts and can
sell **paid memberships** to them. Built solo, from scratch, as a deep dive into
production-style backend architecture — a polyglot microservice mesh, an
event-driven **choreography saga** for payments, load-bearing caching, and
infrastructure-as-code — not another CRUD tutorial app.

**Live demo:** https://dannest-punh.onrender.com/ *(first load takes ~30s — free-tier services sleep when idle)*

---

## What's interesting here

- **A real distributed transaction, done right.** Buying a membership spans three
  services and Stripe, with no two-phase commit and no orchestrator: a
  **choreography saga** over RabbitMQ, a **transactional outbox** on each side so
  an event is never lost, an **idempotent inbox** so redelivery never double-charges,
  and two **compensation paths** (refund on rejection; refund + revoke when the
  payout fails). Written up in [Lesson 8](docs/lessons/lesson-8-membership-saga.md).
- **Polyglot microservices with a reason, not resume-driving.** Two Spring Boot
  services on Postgres + one Node/TypeScript service on MongoDB, each owning its
  own database, talking **only** over an event bus — never a direct
  backend-to-backend call. One service (media) was split out and later
  [folded back in](docs/lessons/lesson-7-remerging-media.md) when the boundary
  stopped paying rent.
- **Real Stripe money movement.** Stripe Connect (Express accounts) for creator
  payouts, PaymentIntents + Stripe Elements for the buyer's card, Transfers for
  the creator's cut, Refunds for compensation — all idempotency-keyed, all
  webhook-driven.
- **Caching that's load-bearing, not decorative.** Redis-backed feed pagination
  cache plus a sorted-set trending leaderboard, both serving real read traffic.
- **Deployed for real.** Terraform-provisioned infra on Render, GitHub Actions
  CI/CD building per-service Docker images to GHCR, SHA-pinned deploys with
  one-click rollback.
- **Documented like production software.** Every non-obvious decision — including
  real production incidents and their fixes — is written up in
  [docs/lessons](docs/lessons/), not left implicit in code.

## Architecture at a glance

```
                 ┌─────────┐
                 │   web   │  Next.js — the only thing a browser loads
                 └────┬────┘
        REST (JWT) ┌──┴──┬───────────────┬─────────────────┐
                   ▼     ▼               ▼                 ▼
             ┌────────┐ ┌────────────┐ ┌─────────────┐  (WebSocket push)
             │  core  │ │notification│ │ marketplace │      ▲
             │ Spring │ │  Spring    │ │ Node + TS   │      │
             └───┬────┘ └─────┬──────┘ └──────┬──────┘      │
        Postgres │      Postgres│        MongoDB│            │
                 │             │               │            │
                 └─────────────┴───────────────┴────────────┘
                        RabbitMQ topic exchange  `dannest.events`
                     (domain events + the membership saga's messages)
```

`core` and `marketplace` never query each other — the only link is a RabbitMQ
event. `web` is the only thing that talks to all three backends. Full service
list, library-by-library breakdown, and sequence diagrams for every flow:
**[docs/tech/architecture-flows.md](docs/tech/architecture-flows.md)**.

## Tech stack

| Layer | Technology | Location |
| --- | --- | --- |
| Frontend | Next.js 16 (React 19, TypeScript), Stripe Elements | `web/` |
| Backend — Core | Spring Boot 3.5 (Java 21) — auth, users, collections, posts, comments, media, membership grants | `services/core/` |
| Backend — Notification | Spring Boot 3.5 (Java 21) — RabbitMQ consumer + WebSocket/STOMP push | `services/notification/` |
| Backend — Marketplace | Node 22 + TypeScript + Express 5 — Stripe Connect, checkout, the saga's money half | `services/marketplace/` |
| Databases | PostgreSQL 17 ×2 (Core, Notification) · MongoDB (Marketplace) — one per service, never shared | per service |
| Message broker | RabbitMQ 4 — topic exchange `dannest.events` | shared |
| Cache / sessions | Redis 7 — refresh tokens, feed cache, trending leaderboard (Core only) | shared |
| Payments | Stripe — Connect, PaymentIntents, Transfers, Refunds, webhooks | Marketplace only |
| Object storage | Cloudflare R2 (S3 API) — media bytes | Core only |
| Infra / CI-CD | Terraform → Render · GitHub Actions → GHCR → Render | `infra/`, `.github/` |

## Features

- Google Sign-In, own JWTs (short-lived access token + revocable rotating refresh token in Redis)
- Collections (public / private / **members-only**), posts, threaded comments, likes, follows
- Media uploads (avatars, covers, post images) to Cloudflare R2 with display-time crop
- Realtime notifications over WebSocket/STOMP, with a polling fallback
- Redis feed-pagination cache + a trending-posts leaderboard on its own `/trending` page
- **Paid memberships** — creator connects Stripe in their profile, marks a collection
  members-only with a price; buyers pay with a real Stripe card form; a saga grants
  access and transfers the creator's cut, or refunds and rolls back on any failure

## Run it locally

```bash
docker compose up -d          # Postgres ×2 + RabbitMQ + Redis (Mongo: use a free Atlas cluster or a local mongod)

cd services/core         && ./gradlew bootRun      # :8090
cd services/notification && ./gradlew bootRun      # :8091
cd services/marketplace  && npm install && npm run dev   # :8092
cd web                   && npm install && npm run dev   # :3000
```

Every service boots with sane local defaults — no config needed for the social
features. Media upload needs Cloudflare R2 credentials; the marketplace needs
Stripe **test-mode** keys. Full prerequisites, the complete environment-variable
reference, and the Stripe/R2 setup steps are in
**[docs/local-dev.md](docs/local-dev.md)**.

## Documentation

**Lessons** (`docs/lessons/`) — chronological "from zero" write-ups of *why*
things were built the way they were, mistakes included:

| # | Lesson |
| --- | --- |
| 1 | [Monorepo](docs/lessons/lesson-1-monorepo.md) |
| 2 | [CI/CD](docs/lessons/lesson-2-cicd.md) |
| 3 | [Google Auth](docs/lessons/lesson-3-google-auth.md) |
| 4 | [Monolith → Microservices](docs/lessons/lesson-4-microservices.md) |
| 5 | [Redis & refresh tokens](docs/lessons/lesson-5-redis-refresh-tokens.md) |
| 6 | [Feed caching, a leaderboard, and a fix we didn't need](docs/lessons/lesson-6-feed-cache-and-trending.md) |
| 7 | [Folding media back into Core](docs/lessons/lesson-7-remerging-media.md) |
| 8 | [The membership saga](docs/lessons/lesson-8-membership-saga.md) — choreography, outbox/inbox, Stripe Connect, compensation |
| 9 | [Waking up for free](docs/lessons/lesson-9-render-cold-start.md) — Render free-tier cold starts, parallel wake-up, a shared warming indicator |

**Technical reference** (`docs/tech/`) — current-state, not a story:

- [Architecture & flows](docs/tech/architecture-flows.md) — every service, the
  libraries each uses, and sequence diagrams for every request/event flow
- [Database schema](docs/tech/db-schema.md) — ER diagrams + table/collection
  reference for all four databases
- [Marketplace open issues](docs/tech/marketplace-open-issues.md) — known gaps in
  the membership saga

## Deployment

Production runs on **Render** — four services (web, core, notification,
marketplace) — with **Neon** Postgres ×2, **MongoDB Atlas**, **CloudAMQP**
RabbitMQ, **Upstash** Redis, **Cloudflare R2**, and **Stripe** (test mode).

- **IaC** — Render services are defined in `infra/*.tf`. `terraform apply`
  *creates*; free-tier services can't be *updated* through Terraform, so config
  changes go via Render's REST API ([Lesson 4 §5](docs/lessons/lesson-4-microservices.md#5-the-re-apply-gotcha-the-part-that-actually-broke)).
- **CI/CD** — `.github/workflows/deploy.yml` runs per push to `main`: for each
  changed service, check → build image → push to GHCR (`:<git-sha>`) → tell
  Render to deploy that exact image. Path filters mean only the changed service
  moves. Details in [Lesson 2](docs/lessons/lesson-2-cicd.md).
- **Rollback** — `.github/workflows/rollback.yml` (manual) rolls one service back
  to a previous deploy; every image is tagged by immutable SHA, never `latest`.

## Roadmap

- [x] Monorepo, Terraform IaC, CI/CD pipeline
- [x] Google Sign-In + JWT, Redis-backed refresh tokens
- [x] Collections, posts, threaded comments, likes, follows
- [x] Notifications extracted into their own service (RabbitMQ + WebSocket/STOMP)
- [x] Media uploads on Cloudflare R2 with display-time crop
- [x] Media split into its own service, then [folded back in](docs/lessons/lesson-7-remerging-media.md)
- [x] Redis feed cache + trending leaderboard
- [x] **Marketplace service + the membership-purchase saga** (Stripe Connect,
      transactional outbox/inbox, choreography over RabbitMQ, both compensation paths)
- [ ] Scheduled "stuck-saga" sweep for purchases that never get a reply
- [ ] Live-mode Stripe (needs account verification)
