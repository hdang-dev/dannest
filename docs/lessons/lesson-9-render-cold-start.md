# Lesson 9 — Waking up for free

DanNest runs four services on Render's **free tier**: `web`, `core`,
`notification`, `marketplace`. Free tier gives you 750 instance-hours a
month — but a service that's been idle for 15 minutes gets put to sleep, and
waking it back up on the next request takes up to ~30 seconds. We'd been
pinging all four every 5 minutes with an external uptime monitor to keep them
always warm. That works, right up until you do the math.

The one-line takeaway: **you can't outrun a shared free-tier hour budget by
keeping everything awake — the fix is to let things sleep, and spend your
effort making the wake-up cheap and honest instead.**

---

## 1. The math that killed the "keep everything warm" plan

750 hours a month is **one pool shared across every free service in the
workspace**, not 750 hours *each*. Pinging 4 services every 5 minutes, 24/7,
keeps all 4 continuously awake — roughly `4 × 730 ≈ 2920` instance-hours a
month. That's about 4x the entire budget, from a monitor that was supposed to
be *saving* us from cold starts.

The uptime monitor had to go. But dropping it makes the cold start visible
again: with nothing keeping services warm, a user who shows up after 15 quiet
minutes waits for whatever they touch to wake up — and today that happens
**serially, on demand**. `AuthProvider` already warms `core` on every load
(its session-refresh call fires immediately on mount), but `marketplace` and
`notification` only wake when a user happens to navigate somewhere that needs
them. Worst case: up to ~30s per service, stacked, as someone clicks around.

## 2. The wrong idea: let RabbitMQ wake `notification`

The first instinct was: `notification` only matters when a domain event
(new comment, membership granted, …) needs delivering, so why keep it warm at
all — let it wake itself when a message shows up.

It can't. **Render's free-tier sleep only lifts on an inbound HTTP request.**
The whole process is suspended while asleep — there's nothing running to
*receive* a RabbitMQ message, let alone wake up because of one. If
`notification` is asleep when `marketplace` publishes
`marketplace.membership.charged`, that message just sits in the queue
(durably — nothing is lost) until something sends `notification` an actual
HTTP request. A message arriving is not a wake trigger; it's just a thing
that waits.

That kills "notify wakes itself" as a strategy. It needs the exact same
explicit wake mechanism as `core` and `marketplace` — no exception for being
event-driven.

## 3. The fix: wake in parallel, not on demand

If cold starts are unavoidable without burning the whole hour budget, the
next best thing is making sure a visit only ever pays for **one** ~30s wake,
not one per service. Two triggers, layered so the earliest one available
always fires first:

```
t=0s   Render boots the web container on the incoming request
       │
       ├─ instrumentation.ts: register() fires 3 unawaited pings ──────┐
       │  (core, marketplace, notification — in parallel)              │
       ├─ Next.js finishes booting, serves HTML+JS                     │  all 3 wake in
       │  (did not wait for the pings above)                           │  the background,
       ├─ browser downloads/hydrates JS                                │  overlapping with
       ├─ React mounts → useServiceWarmup() fires the same 3 pings     │  everything to the
       │  again, as a client-side backstop                             │  left
       ├─ <WarmupBanner/> shows if still pending after 400ms           │
       │                                                                ▼
t≈30s  └─ all 3 backends warm → banner hides ────────────────────────────┘
       (worst case ≈ one wake period, not one per service)
```

- **Server-side** ([`web/src/instrumentation.ts`](../../web/src/instrumentation.ts)) —
  Next's `register()` hook runs once per server instance, before it serves
  any request. Firing the 3 health-check pings here, unawaited, means the
  backends start waking the moment web itself wakes — overlapping with web's
  own boot instead of waiting for a client to load and act.
- **Client-side** ([`web/src/lib/warmup.tsx`](../../web/src/lib/warmup.tsx)) —
  a backstop for the case where web was already warm but a backend had
  independently gone idle.

Both hit the same three unauthenticated health checks
(`core: /actuator/health`, `marketplace: /healthz`,
`notification: /actuator/health`) — already public and CORS-permitted for
web's origin, so no backend changes were needed.

> **Does Flyway running on every boot make this worse?** Checked and ruled
> out. `flyway.enabled: true` runs `migrate()` on every Spring Boot startup,
> but after the first deploy it's a fast no-op — open a connection, check the
> `flyway_schema_history` table, confirm checksums match, done. It doesn't
> replay applied migrations. The real cost of a cold Spring Boot start is JVM
> + Spring context init, which Flyway is a rounding error against.

## 4. Sessions don't stay warm on their own

Proactive pings solve the *first* wake, but a tab can outlive them:

- **A long-open, idle tab.** The mount ping fires once. If nothing else
  happens for 15+ minutes while the tab sits open, a backend can slide back
  to sleep mid-session. Fix: re-ping every 10 minutes (inside the 15-minute
  window) *while the tab is visible*.
- **A backgrounded tab.** Switch away for 20 minutes, switch back — the
  10-minute interval alone could leave up to a 10-minute gap before the next
  scheduled tick. Fix: also re-ping immediately on a `visibilitychange`
  transition to `visible`, not just on the timer.
- **An abandoned tab shouldn't cost anything.** The interval guards itself
  with `document.visibilityState === "visible"` — a hidden tab's timer still
  ticks, but no network call goes out. This is what makes the whole approach
  compatible with the free-tier budget: nothing pings while nobody's looking.

## 5. Two things tried and backed out of

**A hard cap on the banner.** First version force-hid the banner after a
fixed timeout (40s, then 60s) so a genuine outage wouldn't wedge it open
forever. Wrong call — we don't have a solid number for Render's actual wake
time, and hiding the banner early just means *lying* that the app is ready
while it still isn't. Removed the cap entirely: the banner now stays up for
exactly as long as `isWarming()` is true, however long that takes.

**A generic fallback tied to every API call.** The proactive pings reduce
*how often* a real request lands on a sleeping service, but can't guarantee
it never happens — so the first instinct was to also flag any request in
`doFetch` ([`web/src/lib/api.ts`](../../web/src/lib/api.ts)) that was still
pending past ~700ms, on the theory that it's plausibly a cold service. It
technically worked, but it couldn't actually tell a cold start apart from
ordinary slow network — `doFetch` has no way to know *why* a request is
slow — so the banner would show its free-tier copy for a plain bad-network
blip, which read as simply wrong. Pulled it out rather than patch the
wording: a global banner for "some request somewhere is a little slow" is
also just the wrong vehicle for that signal — it can't say *which* thing is
slow, where a feature's own existing loading state (skeleton, spinner) can,
and already exists for exactly this. The banner is proactive-pings-only now;
a cold hit that slips past them just shows whatever local loading state that
feature already has, honestly, with no invented explanation.

## 6. Verifying it for real, not just type-checking it

The riskiest part of this design is invisible by construction — a
fire-and-forget `fetch().catch(() => {})` in a server hook gives no feedback
if it's silently wrong. Two things were worth proving against a real
production-mode boot rather than trusting the code read:

- **`register()` actually fires before any request is served.** Confirmed by
  pointing `NEXT_PUBLIC_*` at local listener processes, running `next build &&
  next start`, and watching the listeners receive all 3 requests within
  milliseconds of server boot — before a browser ever touched the app.
- **Build-time inlining, not runtime env.** `NEXT_PUBLIC_*` vars are baked
  into the bundle at `next build`; the Dockerfile's run stage deliberately
  doesn't set them again. Rebuilt with dummy URLs passed only as build args
  (mirroring the Dockerfile's `ARG` → `ENV` pattern), then ran the server with
  `.env.local` removed and no `NEXT_PUBLIC_*` set at runtime — exactly what
  the container's run stage looks like. It still pinged the build-time URLs.
  Had it depended on runtime env instead, the container would've silently
  pinged nothing useful in production, and there'd have been no error to
  notice — just three pings that quietly went nowhere.

Both were real failure modes worth ruling out before shipping, not
hypotheticals — a background trigger with no observable failure is exactly
the kind of thing that looks fine in dev and does nothing in prod.

## 7. What you achieved ✅

- Recognized that Render's 750 free hours is one pool across every service,
  not per-service — the number that actually forced dropping the always-on
  monitor.
- Corrected a wrong mental model before building on it: a sleeping free-tier
  service can only be woken by an inbound HTTP request, never by a queued
  message, no matter how event-driven the service is.
- Turned a serial, on-demand wake-up (up to ~30s × 3, stacked) into an
  overlapped one (~30s once) with two layered triggers — a server boot hook
  and a client backstop.
- Handled the two session-length gaps proactive pings alone can't cover
  (long-idle-but-open, and backgrounded-then-refocused) without spending
  instance-hours on tabs nobody's looking at.
- Tried a generic request-driven fallback for cold hits that slip past the
  proactive pings, found it couldn't distinguish a cold start from ordinary
  slow network, and backed it out rather than ship a banner that's
  confidently wrong some of the time — a feature's own loading state already
  covers that case, honestly.
- Proved the two riskiest, most silent parts (the boot-time hook actually
  firing, and build-time vs. runtime env) against a real production-mode
  build instead of trusting a type-check.

## Cheat sheet 📇

| Problem | Answer |
|---|---|
| Free tier's hour budget is shared across services | Don't keep anything on 24/7 — an always-on monitor can burn the whole budget on its own |
| "Let the queue wake the sleeping consumer" | Doesn't work — only inbound HTTP lifts a free-tier sleep, never a broker message |
| Serial per-service wake-up on user navigation | Fire all wake pings in parallel, as early as possible (server boot + client mount) |
| A long-open tab lets a backend re-sleep mid-session | Silent re-ping on an interval, only while the tab is visible |
| A backgrounded tab, refocused later | Re-ping immediately on `visibilitychange` → `visible`, don't wait for the next tick |
| A global "loading" signal that can't tell *why* | Don't guess — let the feature's own local loading state cover it instead |
| A guessed timeout to hide a "waking up" banner | Don't cap it — hiding early just means lying that it's ready |
| A background hook fails silently | Prove it against a real prod-mode boot (build args, no runtime env) — don't trust the read |

## Key words

- **Cold start** — the latency a sleeping service pays on its next request
  before it's ready to serve.
- **Shared instance-hour pool** — Render free tier's 750 hours/month is one
  budget across every free service in the workspace, not per service.
- **Proactive warm-up** — waking a dependency before anything actually needs
  it, to absorb the cold-start cost outside the user's critical path.
- **Fire-and-forget** — an async call that's started but not awaited by its
  caller, so it can't block or fail the caller's own response.
- **Debounced/delayed loading indicator** — only showing a "loading" UI once
  an operation has been pending past a short threshold, so fast operations
  never flash it.
- **Build-time vs. runtime env** — `NEXT_PUBLIC_*` values are substituted into
  the bundle when `next build` runs; setting them later, at container
  runtime, has no effect on an already-built bundle.
