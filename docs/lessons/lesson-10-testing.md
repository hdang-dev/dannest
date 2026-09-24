# Lesson 10 — Testing three stacks, and what it actually caught

DanNest had zero tests until this pass: 95 files in `core`, 27 in
`marketplace`, 56 in `web`, all untested. The goal was straightforward — add
unit and integration tests across all three. What actually happened was less
straightforward: three real bugs surfaced along the way, one wrong assumption
about local infrastructure got corrected mid-stream, and a fourth piece of
work (a full end-to-end suite) got built, proven working, and then
deliberately thrown away.

The one-line takeaway: **tests earn their keep by finding things you didn't
know were wrong — if a testing pass doesn't surface at least one real bug,
it's probably not looking hard enough.**

---

## 1. One testing approach, three stacks that don't agree on vocabulary

`core` (Spring Boot), `marketplace` (Express), and `web` (Next.js) each needed
their own tool: JUnit 5 + Mockito + AssertJ for `core` (already bundled via
`spring-boot-starter-test`, nothing to install), Vitest + Supertest +
`mongodb-memory-server` for `marketplace`, Vitest + React Testing Library for
`web`. Chosen against actual 2026 adoption data (npm download trends, the
State of JS survey, and real Vietnamese job postings on ITviec), not habit.

The more useful realization was conceptual, not tooling: the old
unit/integration/E2E "pyramid" doesn't map cleanly onto a frontend. Rendering
a React component with Testing Library exercises the component, its
sub-components, its hooks, and real utility functions all at once — several
real units working together — which is *integration* by Kent C. Dodds'
"Testing Trophy" definition, even though every network call in it is mocked.
Mocking the data layer doesn't make something a unit test; testing exactly
one isolated piece does. Almost every `web` "component test" in this pass is
honestly an integration test wearing a unit test's clothes.

## 2. `marketplace`: a duplicate delivery that hung for two minutes

The saga's idempotency guard (`inbox.service.ts`) catches a MongoDB duplicate-key
error and returns `false` — "already processed, skip it." The unit test (fully
mocked) passed immediately. The integration test — same function, against a
real temporary MongoDB via `mongodb-memory-server` — hung for the full test
timeout.

The real bug: inside a MongoDB transaction, **any** failed write aborts the
whole transaction server-side, even if the application code catches the error.
`claim()` was catching it and returning `false` like nothing happened, but the
transaction underneath was already dead. The driver's `withTransaction()`
wrapper then tried to commit that dead transaction, failed, and retried the
*entire* operation — hitting the same duplicate key again, forever, until its
own ~2-minute internal budget ran out.

RabbitMQ and Stripe both redeliver messages routinely, not just on failure —
so this wasn't a rare edge case, it was every normal redelivery turning into a
multi-minute stall. Fix: explicitly `session.abortTransaction()` before
returning `false`, so the driver's wrapper sees the transaction already ended
and skips the doomed commit. A mocked unit test structurally cannot catch
this class of bug — it requires a real database enforcing real transaction
semantics.

## 3. `core`: the local database that already had opinions

The first integration test for the membership saga asserted "exactly one
inbox row exists after a redelivery" — and got back **38**. The local Postgres
used for testing was the same one used for months of manual local development;
it had real leftover data. The assertion was accidentally counting *all*
history, not just this test's own write.

Scoping the assertion to this test's own random event ID fixed the immediate
failure, but the deeper problem was structural: **tests and manual dev
sharing one database is not a testing setup, it's a landmine.** The fix —
[Testcontainers](https://testcontainers.com/) — spins up a fresh, disposable
Postgres and Redis in Docker *per test run*, wired in automatically via
Spring Boot's `@ServiceConnection`. No shared state, no dependency on
whatever's running locally, and it works identically in CI (GitHub-hosted
runners already have Docker; no extra service container needed). Verified by
stopping every local service entirely and re-running the suite — still green.

Also surfaced along the way, purely by testing against the real schema: both
`collections.owner_id` and `collection_membership.user_id` have real foreign
keys to `users`. Not a bug — the code never assumed otherwise — but not
visible from reading the Java either. Only the real database, under a real
integration test, made it obvious.

## 4. `web`: an error that never got a chance to render

`CommentSection`'s initial comment fetch has a `.catch()` that sets an error
message — but never moves the component out of its "loading" state. The
`if (comments === null) return <Loading/>` guard runs *before* the error
JSX, so a failed load left the user staring at "Loading comments…" forever,
with the real error message sitting unreachable a few lines further down.
Caught by an integration test that actually made the mocked fetch reject,
instead of only testing the happy path. Fix: on failure, set `comments` to
`[]` as well as setting the error, so the component actually exits loading
and the message underneath becomes reachable.

## 5. Building E2E, proving it worked, then cutting it anyway

A Playwright suite got built for the flagship journey — buy a membership,
trigger the real cross-service saga (`marketplace` → RabbitMQ → `core` →
RabbitMQ → `marketplace`), see the purchase confirmed. Since the app's *only*
login path is real Google OAuth (no test backdoor, and automating Google's
own login screen isn't realistic), the test seeded a real user straight into
Postgres and wrote the exact Redis entry a real login would have created —
skipping only the Google screen itself, letting every check after that run
for real. Local webhook delivery needed the Stripe CLI tunneling real events
to `localhost`, since Stripe's servers can't reach a laptop directly.

It worked. The full saga ran for real — real Stripe test-mode payment, real
RabbitMQ messages, a real Stripe Transfer paying the seeded creator's account,
confirmed by querying MongoDB directly (`status: "CONFIRMED"`, a real
`stripeTransferId`). Along the way, it even caught a fourth real bug: the
purchase-result screen shows a false "you've been refunded" message if the
saga is simply still in progress past the frontend's 15-second poll window,
rather than recognizing "still processing" as its own case.

And then it got removed. Checking actual practice (not assumption) showed
E2E suites are usually scoped tightly — a handful of critical flows, often
gated to merges rather than every push, precisely because of the setup cost
just demonstrated: real infrastructure, real external services, real
environment-mismatch debugging (Stripe CLI defaulted to the wrong sandbox
entirely, once). For this project, unit and integration coverage across all
three stacks was judged the better time investment than maintaining that
weight. The work wasn't wasted — the login-bypass pattern and the mechanics
are proven and written up here if a future pass wants them back.

## 6. What you achieved ✅

- Took three codebases from zero tests to ~230 tests, each in the
  idiomatic tool for its stack, backed by actual 2026 adoption data instead
  of habit.
- Found and fixed three real bugs that only a *real* database or a *real*
  failure path could have surfaced — a transaction left in a doomed state
  (`marketplace`), and an unreachable error state (`web`).
- Caught your own testing setup being unsafe (sharing a database between
  tests and manual dev) before it caused real damage, and replaced it with
  Testcontainers instead of just being more careful by hand.
- Built a working full-stack E2E suite — including solving the hard part,
  authenticating a test user without touching a real Google account — proved
  it end-to-end against real Stripe, and then made the call to cut it based
  on real practice rather than sunk cost.
- Wired all of it into CI (`./gradlew build`/`test`, `npm test`) so none of
  this is provable-once-and-forgotten.

## Cheat sheet 📇

| Problem | Answer |
|---|---|
| "Unit vs integration" on a frontend | If rendering a component exercises other real components/hooks/functions, it's integration — mocking the network doesn't change that |
| A mocked test can't prove a real DB constraint holds | Run the same code against a real (disposable) database too |
| Catching a DB error doesn't undo a transaction abort | Explicitly abort the session yourself before returning — don't let the driver retry a doomed commit |
| Tests sharing a database with manual dev work | Testcontainers — a fresh, throwaway database per test run, identical locally and in CI |
| An error state that's unreachable in the JSX | Always give the component a way out of "loading," even on failure |
| E2E needs a real login, but only OAuth exists | Seed the session data directly (DB row + cache entry) — skip only the third-party screen, not your own backend's checks |
| Whether to keep a working E2E suite | Check what real projects actually do, not what feels thorough — scope to the setup cost you're willing to carry |

## Key words

- **Testing Trophy** — Kent C. Dodds' frontend-testing model: most of a React
  app's tests are honestly *integration* tests (several real units rendered
  together), even with the network mocked; true isolated-function tests are
  the minority.
- **Testcontainers** — a library that starts real, disposable Docker
  containers (a database, a broker) for the duration of a test run, then
  tears them down — no shared, persistent test infrastructure.
- **Transaction abort** — a database ending a transaction after any failed
  write inside it; the failure can't be silently absorbed by the calling
  code without explicitly acknowledging the abort.
- **Idempotent inbox** — a guard that lets a message handler safely ignore a
  redelivered message it's already processed, keyed by a unique event id.
- **E2E (end-to-end) test** — a test that drives the real, fully running
  system (every service, every real dependency) the way an actual user
  would, as opposed to a unit or integration test that isolates one part of it.
