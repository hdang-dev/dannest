# DanNest — Learning Notes

Personal notes explaining what this project is and how it works, written from
scratch for someone new to backend/DevOps.

## Lessons

1. [Monorepo](./lesson-1-monorepo.md) — one repo holding the frontend + backend + infra.
2. [CI/CD](./lesson-2-cicd.md) — how code gets automatically checked and deployed.
3. [Google Auth](./lesson-3-google-auth.md) — Google Sign-In → our own JWT.
4. [Monolith → Microservices](./lesson-4-microservices.md) — splitting the
   backend into two services talking over RabbitMQ, and the real deploy
   problems that caused.
5. [Redis & refresh tokens](./lesson-5-redis-refresh-tokens.md) — why a
   plain JWT can't be revoked, and the short-access-token +
   Redis-backed-refresh-token flow that fixes it.

## The 60-second overview

DanNest is a small social/collection website, split into a frontend and two
independent backend services:

```
web/                     the frontend    (Next.js / React / TypeScript)  → Render
services/core/           auth, users,                                    → Render
                         collections, posts, comments  (Spring Boot)
services/notification/   notifications only              (Spring Boot)   → Render
                         (own database, fed by events over RabbitMQ)

2 databases   Postgres × 2 (one per backend service)                     → Neon
message bus   RabbitMQ                                                   → CloudAMQP
```

Core and Notification never share a database or call each other directly —
Core publishes an event, Notification consumes it whenever it gets to it.
See [Lesson 4](./lesson-4-microservices.md) for why that split exists and
what it took to actually run in production.

When you push code to GitHub, a robot (GitHub Actions) checks it and — if it's
healthy — deploys the changed service automatically.

```
you push code
   │
   ▼
GitHub Actions (robot):  check the code  →  deploy what changed
   │
   ▼
live on the internet 🎉
```
