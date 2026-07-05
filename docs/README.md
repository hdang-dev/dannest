# DanNest — Learning Notes

Personal notes explaining what this project is and how it works, written from
scratch for someone new to backend/DevOps.

## Lessons

1. [Monorepo](./lesson-1-monorepo.md) — one repo holding the frontend + backend + infra.
2. [CI/CD](./lesson-2-cicd.md) — how code gets automatically checked and deployed.

## The 60-second overview

DanNest is a small social/collection website with three parts:

```
web/       the frontend   (Next.js / React / TypeScript)     → runs on Render
service/   the backend    (Spring Boot / Java)               → runs on Render
database   Postgres                                          → runs on Neon
```

When you push code to GitHub, a robot (GitHub Actions) checks it and — if it's
healthy — deploys the changed part automatically.

```
you push code
   │
   ▼
GitHub Actions (robot):  check the code  →  deploy what changed
   │
   ▼
live on the internet 🎉
```
