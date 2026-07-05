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
🤖 GitHub Actions:
     ├─ check web/     (install → lint → build the Next.js app)
     ├─ check service/ (build + test the Spring Boot app,
     │                  using a throwaway Postgres just for the test)
     │
     └─ if the checks pass → tell Render to redeploy
   │
   ▼
app is live 🎉
```

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

- **Smart host** (Render, Vercel, Netlify) — you send a "deploy now" **signal**,
  and the host pulls your code from GitHub, builds it, and runs it. Your robot's
  deploy step is tiny (one API call).
- **Dumb runner** (AWS, Kubernetes) — the host does **not** know your GitHub.
  Your robot does the work: build a Docker image → push it to a registry →
  tell the host to run that image.

```
Render → smart host → robot just says "go"          (thin robot)
AWS    → dumb runner → robot builds + ships + runs    (fat robot)
```

The more the host does for you, the less your robot does. We use **Render**
(smart host), so our deploy step is a single `curl` that says "deploy now."

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

## 11. What you achieved ✅

- App **live in production**: web + backend + Neon database.
- **Infrastructure as Code** (Terraform creates the Render services).
- **A CI/CD robot** that checks both apps and deploys **only what changed**.
- Secrets handled the right way (never committed).

## Cheat sheet 📇

| What you change | What happens |
| --- | --- |
| Frontend code (`web/`) | push → web redeploys |
| Backend code (`service/`) | push → backend redeploys |
| Database schema | add `service/src/main/resources/db/migration/V#__*.sql` → push → Flyway applies it on deploy |
| New env var | edit `infra/main.tf` → run `terraform apply` (manual) |
| Infra (Render service settings) | edit `infra/*.tf` → run `terraform apply` (manual) |

## Key words

- **CI / CD** — check the code / ship the code, automatically.
- **Pipeline** — the robot's list of steps (in `deploy.yml`).
- **GitHub Actions** — GitHub's robot that runs the pipeline.
- **Docker / Dockerfile** — a recipe to package an app into a runnable image.
- **Host** — where an app runs live (Render, Neon).
- **IaC (Infrastructure as Code)** — your servers described in a file (Terraform).
- **State** — Terraform's memory of what it built (`terraform.tfstate`).
- **Secret** — a sensitive value (password, key) kept out of Git.
- **Path filter** — deploy only the folder that changed.
- **Migration** — a versioned SQL file that changes the database schema.
