# Lesson 2 — CI/CD (from zero)

This is the "how does my code get online automatically" lesson.

## 1. The two words

- **CI = Continuous Integration** → a robot that **CHECKS** your code every time
  you push. *"Does it build? Do the tests pass?"* → ✅ or ❌.
- **CD = Continuous Deployment** → a robot that **DEPLOYS** your app (puts it
  online) automatically.

Put simply: **CI checks the code, CD ships the code.**

## 2. The robot analogy 🤖

You can do CI + CD with **two robots** or **one robot**:

```
TWO robots                        ONE robot (what we built)
──────────                        ─────────────────────────
🤖 GitHub → checks                🤖 GitHub Actions → checks the code
🤖 Host   → deploys                                 → AND triggers the deploy
```

We built **one robot**: **GitHub Actions** checks the code, then tells the
hosts to deploy. One to-do list, done in order.

## 3. The pieces (and what each one is)

| Piece | What it is | Where |
| --- | --- | --- |
| **GitHub Actions** | the robot (runs the pipeline) | `.github/workflows/deploy.yml` |
| **Docker** | a recipe to *package* the backend into a runnable box | `service/Dockerfile` |
| **Render** | a "home" that runs the web + backend 24/7 | (cloud) |
| **Neon** | a "home" that runs the Postgres database | (cloud) |
| **Terraform** | describes the infrastructure as code | `infra/*.tf` |

Important idea: **GitHub can't *run* your app** — it's just a worker. Your app
needs a **home** (Render / Neon) to live in. The robot checks the code, then
*delivers* it to that home.

## 4. How it flows

```
you push code to main
   │
   ▼
🤖 GitHub Actions (CI):
     ├─ check web/                (install → lint → build the Next.js app)
     ├─ check service/            (build + test the Spring Boot app,
     │                             using a throwaway Postgres just for the test)
     │
     └─ if the checks pass → build a Docker image → push it to GHCR,
        tagged with the commit SHA (ghcr.io/<owner>/<service>:<sha>)
   │
   ▼
🤖 GitHub Actions (CD):
     └─ tell Render: "run exactly this image" (one API call, imageUrl=<sha tag>)
   │
   ▼
app is live 🎉  (running the same image bytes CI just built and tested)
```

We package the app **once**, as a Docker image, and that same image is what
gets tested (implicitly, by being built from the same source the checks just
passed) and what runs in production. Nothing rebuilds on Render's side.

## 5. Deploy only what changed (path filters)

The robot is smart: it looks at **which folder** changed.

- Change something in `web/`  → **only the web** redeploys.
- Change something in `service/` → **only the backend** redeploys.
- Change both → both redeploy.

This avoids rebuilding everything for a one-line change.

## 6. App code vs Infra code (important!)

There are **two kinds of code**, and they behave differently:

```
APP code   (web/, service/)  →  push  →  🤖 robot deploys automatically
INFRA code (infra/*.tf)      →  push  →  🧑 YOU run `terraform apply` by hand
```

- Changing a feature = app code = **automatic**.
- Changing infrastructure (like adding an env var in `infra/main.tf`) = infra
  code = **manual** (`terraform apply` from your laptop).

Why manual? Automating infra needs the robot to share Terraform's "memory"
(the state file), which requires a paid/extra cloud "box." For a solo project,
running one command by hand a few times is simpler. Infra changes are rare.

## 7. Secrets — kept safe 🔒

**Real secrets never go in Git.** They live in three safe places:

| Secret | Lives in | In Git? |
| --- | --- | --- |
| DB password, API keys (for Terraform) | `infra/terraform.tfvars` | ❌ gitignored |
| Render API key (for the robot) | GitHub **Secrets** | ❌ encrypted |
| DB creds (for the running app) | Render **env vars** | ❌ not in code |
| GHCR push auth | GitHub's built-in `GITHUB_TOKEN` | n/a — auto-issued per run, never stored |

No new secret was needed to push images to GHCR — every workflow run already
gets a short-lived `GITHUB_TOKEN`, and granting the job `packages: write`
permission (in `deploy.yml`) is enough for it to push. Our GHCR packages are
public, so Render doesn't need any credential to pull them either.

The **only** "secrets" in the repo are *fake* ones — the throwaway test
database's password (`dannest/dannest`) in the workflow. That database is
empty, temporary, and deleted after each test, so it's safe to hardcode.

## 8. Infrastructure as Code (IaC) — the bonus skill

Instead of clicking buttons in a dashboard to set up servers, we **wrote the
setup as code** (`infra/*.tf`) using **Terraform**.

```
infra/*.tf   →   terraform apply   →   creates both services on Render
```

Benefits:
- Recreate your whole setup from one file.
- Every change is tracked in Git.
- No "how did I configure that again?"

It's like a **recipe for your servers**. `render.yaml` and Terraform are both
IaC; Terraform is the powerful, works-anywhere one.

## 9. Who does the deploy work? (host types)

Not all hosts work the same. There are **two models**:

- **Smart host, build-from-source** — you send a "deploy now" **signal**, and
  the host pulls your code from GitHub, builds it, and runs it. Your robot's
  deploy step is tiny (one API call), but the host is doing a build every
  time, from whatever the branch currently points at.
- **Dumb runner, run-a-prebuilt-image** — the host does **not** build
  anything. Your robot does that work: build a Docker image → push it to a
  registry (GHCR) → tell the host to run *that exact image*.

```
Render, build-from-source → robot just says "go"              (thin robot)
Render, run-a-prebuilt-image → robot builds + ships + says "run this one"  (fat robot)
```

We use Render, but not as a smart host anymore — Render's job is now only to
**run** a container, never to build one. GitHub Actions does the building
(the "fat robot"), pushes the image to **GHCR** (GitHub Container Registry),
and the deploy step tells Render exactly which image tag to run:

```yaml
# deploy step, e.g. deploy-web
run: |
  curl -X POST ... \
    -d '{"imageUrl":"ghcr.io/<owner>/web:<commit-sha>"}' \
    ".../services/<id>/deploys"
```

Why bother, if Render *could* build for us? Because "build on the host" means
the exact bytes running in production are whatever Render's build happened to
produce at deploy time — you can't point at them, diff them, or re-run the
exact same one later. An image tagged with the commit SHA is a fixed,
addressable artifact: the thing CI tested and the thing running in
production are provably the same bytes.

## 10. Why we trigger deploy from the robot (gating)

We turned **OFF** Render's "auto-deploy on push" and instead let GitHub Actions
trigger the deploy. Why bother?

Because our deploy job **depends on the checks passing**:

```yaml
deploy-web:
  needs: [changes, check-web]   # deploy runs ONLY IF the check passed
```

- **Auto-deploy ON** → Render deploys on *every* push, even if tests failed →
  broken code can go live. ❌
- **Our way** → deploy happens **only after checks are green** → broken code
  **can't** deploy. ✅

This is called **gating**: *CI gates CD.* It's the professional pattern — a
little more setup, but broken code never reaches production.

## 11. What happens when something fails (and rolling back)

"CI/CD fails" can mean three different things — they're handled differently,
and **registry visibility (public/private) has nothing to do with any of them**:

1. **Checks or the Docker build fail** — nothing gets pushed to GHCR, and the
   deploy job never runs (it `needs:` the build job, and a failed/skipped
   dependency skips downstream jobs too). Render is never contacted. Whatever
   was already live keeps running, untouched.
2. **The new image gets deployed but fails to start / fails its health
   check** — Render itself cancels that deploy and keeps the previous
   instance running. This is automatic, built into Render, and applies the
   same way to image-backed services as git-built ones — you don't have to
   build this yourself.
3. **The new image deploys fine and passes health checks, but has a real bug
   health checks don't catch** — this is the one case nothing catches for
   you. That's what `rollback.yml` is for: pick the service and a previous
   `deploy_id` (Render dashboard -> service -> Events tab), and it calls
   Render's `POST /services/{id}/rollback` endpoint, which re-pulls the exact
   image that earlier deploy used and restores its start command / health
   check / env vars.

Rollback only works reliably because every image is tagged with the
**immutable commit SHA**, never `latest`. Render's own docs warn that rolling
back a *mutable*-tag deploy can pull whatever that tag currently points to —
not what was actually running back then. Our tags never get overwritten, so
this can't happen. It also means: **if you ever add a GHCR cleanup/retention
job, don't delete the SHA tag for any deploy you might still want to roll
back to** — a deleted image makes that rollback fail.

All four services have `auto_deploy = false` in Terraform, so there's no risk
of an autodeploy silently undoing a rollback (a footgun Render's docs flag
for services where autodeploy is on).

## 12. What you achieved ✅

- App **live in production**: web + 3 backends + Neon/Mongo databases.
- **Infrastructure as Code** (Terraform creates the Render services).
- **A CI/CD robot** that checks each app, packages it as a Docker image, and
  deploys **only what changed** — the exact image it just built and tested.
- Secrets handled the right way (never committed).

## Cheat sheet 📇

| What you change | What happens |
| --- | --- |
| Frontend code (`web/`) | push → web checked → image built → pushed to GHCR → Render runs it |
| A backend's code (`services/*/`) | push → that service checked → image built → pushed to GHCR → Render runs it |
| Database schema | add `services/*/src/main/resources/db/migration/V#__*.sql` → push → Flyway applies it on container startup |
| New env var | edit `infra/main.tf` → run `terraform apply` (manual, only works for *new* services on free tier — see README) |
| Infra (Render service settings) | edit `infra/*.tf` → run `terraform apply` (manual) |
| Switching a service's image source/registry credential | Render dashboard or REST API — Terraform doesn't manage this on existing free-tier services (manual, one-time) |

## Key words

- **CI / CD** — check the code / ship the code, automatically.
- **Pipeline** — the robot's list of steps (in `deploy.yml`).
- **GitHub Actions** — GitHub's robot that runs the pipeline.
- **Docker / Dockerfile** — a recipe to package an app into a runnable image.
- **GHCR** — GitHub Container Registry; where CI pushes the images it builds, and where Render pulls them from.
- **Image tag** — a label pointing at one specific image; we tag with the commit SHA so the tag is a fixed, addressable artifact, not a moving target.
- **Host** — where an app runs live (Render, Neon).
- **IaC (Infrastructure as Code)** — your servers described in a file (Terraform).
- **State** — Terraform's memory of what it built (`terraform.tfstate`).
- **Secret** — a sensitive value (password, key) kept out of Git.
- **Path filter** — only process the service whose folder changed.
- **Migration** — a versioned SQL file that changes the database schema.
