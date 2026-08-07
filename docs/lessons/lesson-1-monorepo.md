# Lesson 1 — Monorepo

## What is a monorepo?

A **monorepo** = **one** Git repository that holds **multiple** apps.

- ❌ Without: one repo for the frontend, a *separate* repo for the backend.
- ✅ Monorepo: **one** repo with both apps inside it.

DanNest looks like this:

```
github/              ← ONE git repo (this is what we push to GitHub)
├── web/             ← frontend  (Next.js)
├── service/         ← backend   (Spring Boot)
├── infra/           ← infrastructure as code (Terraform)
└── docs/            ← these notes
```

## Why use a monorepo?

- **One place for everything** — no jumping between repos.
- **Change things together** — update the frontend and backend in one commit / one Pull Request.
- **Easier to share** — one link, one clone.

(Big companies like Google keep almost *all* their code in one giant monorepo.)

## The tricky part: two languages ("polyglot")

Our two apps use **different tools**:

| App | Language | Tool that builds it |
| --- | --- | --- |
| `web/` | JavaScript / TypeScript | **npm** |
| `service/` | Java | **Gradle** |

They don't share a build tool. So the rule we followed:

> **Each app keeps its OWN toolchain, and the repo root stays neutral.**

- All JavaScript lives **inside `web/`** (its own `package.json`, its own `node_modules`).
- All Java lives **inside `service/`** (its own Gradle files).
- The **root** has *no* JavaScript, *no* `package.json` — it's just a container.

This is called a **polyglot monorepo** (poly = many, glot = languages).

## A decision we made (and why)

We considered adding a root `package.json` + **Turborepo** (a tool that runs
tasks across many JS apps). We **skipped it** because:

- Turborepo helps when you have *many* JavaScript apps sharing code.
- We have **one** frontend + one Java backend → it would add complexity for no benefit.

Lesson: **don't add tools you don't need yet.** Start simple; add power when you actually need it.

## What you achieved ✅

- A clean monorepo: `web/` + `service/` + `infra/` in one repo.
- Each app self-contained with its own toolchain.
- Pushed to GitHub (authored as `hdang-dev` via a per-project SSH key, so it
  stays separate from your work account).

## Key words

- **Monorepo** — one repo, many apps.
- **Polyglot** — using more than one programming language.
- **Toolchain** — the set of tools that build/run an app (npm for JS, Gradle for Java).
- **Workspace / package** — a self-contained app or library inside the repo.
