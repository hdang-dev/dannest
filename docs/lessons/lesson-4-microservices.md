# Lesson 4 — Monolith → Microservices (from zero)

This is the "how did we split one app into three services and keep it all
alive" lesson. It covers three separate things that all changed together:
**code**, **infrastructure**, and **the deploy process itself**.

## 1. Before vs after

```
BEFORE                              AFTER
──────                              ─────
web/          (frontend)            web/                 (frontend)
service/      (ALL backend logic)   services/core/        (auth, users, posts,
                                                             comments, collections)
                                     services/notification/ (notifications only)

1 Postgres database                 2 Postgres databases (one per service)
2 Render services                   3 Render services
(no message broker)                 RabbitMQ (CloudAMQP)
```

**Why split at all?** Not because the app needed it — a solo project this size
runs fine as one app. We split it **to practice real microservices patterns**:
separate deploys, separate databases, and services talking over a message
broker instead of a direct function call. That's the whole point of this
lesson: the payoff is the learning, not a performance win.

## 2. The rule that makes it "microservices" and not just "folders"

Renaming `service/` to `services/core/` alone would just be reorganizing a
monolith. What actually makes two services **independent** is:

1. **Separate processes** — `services/core` and `services/notification` are
   two different Spring Boot apps, each with its own `build.gradle`, each
   started/stopped/deployed independently.
2. **Separate databases** — `services/notification` has its own Postgres and
   **cannot query Core's database**. If it needs data from Core (like a
   post author's username), Core has to hand it over some other way.
3. **Talk over the network, not a function call** — instead of
   `notificationService.notify(...)` calling straight into another class in
   the same process, Core drops a message on a queue and moves on. It has no
   idea if or when Notification processes it.

Rule #2 is the one people skip. If two "services" still share one database,
they're not really separate — they're a monolith with extra deploy steps.

## 3. Code changes

### 3a. Denormalize the event, don't share a database

Since Notification can't query Core's database, the event Core publishes has
to carry **everything the notification needs to display itself** — not just
IDs.

```java
// services/core/.../event/DannestEvent.java
public record DannestEvent(
    String eventType,        // "NEW_POST", "COMMENT_REPLY"
    UUID recipientId,
    UUID actorId,
    String actorUsername,    // ← denormalized, not just actorId
    String actorAvatarUrl,
    UUID collectionId,
    String collectionName,   // ← denormalized, not just collectionId
    UUID postId,
    UUID commentId,
    Instant occurredAt
) {}
```

Both services keep their **own copy** of this record (same fields, two
files). That's deliberate — a shared library would couple their deploys
together, which defeats the purpose of splitting them.

### 3b. Publish and forget — never let the broker break the real write

The very first version of this crashed production. `RabbitTemplate.send()`
can throw or hang if it can't reach the broker — and since it was called
*inside* the same transaction as saving a post, a broker outage would have
rolled back the post save too. Fixed by making publish best-effort:

```java
public void publish(DannestEvent event) {
    try {
        rabbitTemplate.convertAndSend(EVENTS_EXCHANGE, event.eventType(), event);
    } catch (RuntimeException ex) {
        log.warn("Failed to publish {} event: {}", event.eventType(), ex.getMessage());
        // swallowed on purpose — a broker outage must never break a post/comment save
    }
}
```

**Lesson:** anything you bolt onto an existing write path (analytics,
notifications, webhooks) should degrade to "silently skipped," never
"breaks the feature that was already working."

### 3c. Consume, persist, then push live

```java
@RabbitListener(queues = "notification.events")
public void onEvent(DannestEvent event) {
    notificationService.recordFromEvent(event); // save row + WebSocket push
}
```

The consumer does two things in order: **save to its own database first**,
**then** push over WebSocket. If nobody's browser is connected, the push just
evaporates — but the row is already safely in Postgres, so the next page
load (or poll) picks it up anyway. Never make the "nice to have" (realtime)
a requirement for the "must have" (the data existing).

## 4. Infrastructure changes

| What | Before | After |
| --- | --- | --- |
| Backend services | 1 (`dannest-service`) | 2 (`dannest-service`, `dannest-notification`) |
| Databases | 1 Neon Postgres | 2 Neon Postgres (one per service) |
| Message broker | none | RabbitMQ (CloudAMQP free tier) |
| `infra/main.tf` resources | 2 `render_web_service` blocks | 3 `render_web_service` blocks |

New Terraform variables were added for things that didn't exist before —
`rabbitmq_host`, `rabbitmq_username`, `rabbitmq_password`, `rabbitmq_vhost`,
`notification_db_url`, etc. — following the exact same pattern as the
existing `db_url`/`jwt_secret` variables: declared in `variables.tf`, real
values only ever in the gitignored `terraform.tfvars`.

## 5. The re-apply gotcha (the part that actually broke)

This is the part that doesn't show up in a tutorial. `terraform apply` on a
**free-tier Render service** behaves differently depending on what you're
doing to it:

```
terraform apply on a service that DOESN'T exist yet  →  CREATE  →  ✅ works
terraform apply on a service that ALREADY exists     →  UPDATE  →  ❌ rejected
```

Render's free tier rejects the "maintenance mode" field the Terraform
provider's update call includes. So renaming `service/` to `services/core/`
— which changes the Dockerfile path Render builds from — could not be pushed
by `terraform apply`, even though `main.tf` had the correct new path.

**The fix wasn't "click it by hand in the dashboard."** It was: call
Render's REST API **directly**, bypassing Terraform's provider entirely —
the same technique `deploy.yml` already used to trigger deploys.

```bash
# Fix the Dockerfile path (a narrower call than Terraform's full "update service")
curl -X PATCH -H "Authorization: Bearer $RENDER_API_KEY" \
  -d '{"serviceDetails":{"envSpecificDetails":{
        "dockerfilePath":"./services/core/Dockerfile",
        "dockerContext":"./services/core"}}}' \
  "https://api.render.com/v1/services/$SERVICE_ID"

# Push one env var at a time
curl -X PUT -H "Authorization: Bearer $RENDER_API_KEY" \
  -d '{"value":"shark.rmq.cloudamqp.com"}' \
  "https://api.render.com/v1/services/$SERVICE_ID/env-vars/RABBITMQ_HOST"
```

Both succeeded with no error. **Lesson:** "the tool can't do X" often really
means "*this specific abstraction* can't do X" — the platform underneath
(Render's actual API) usually can, via a narrower, more direct call.

## 6. The actual deploy sequence, in order

```
1. git push main
     → CI builds + tests web/ and services/core/
     → triggers a Render deploy for each — but Core's build FAILS
       (Render still configured for the old service/Dockerfile path)

2. Fix Core's settings via direct Render API (not terraform apply):
     → PATCH the Dockerfile path/context
     → PUT the 6 RABBITMQ_* env vars
     → trigger a fresh deploy → now LIVE

3. terraform apply
     → this is a CREATE for the new notification service → succeeds
     → Render auto-builds it on creation → LIVE

4. PUT NEXT_PUBLIC_NOTIFICATION_API_URL on the web service via API
     → NEXT_PUBLIC_* vars are baked in at BUILD time, so this alone
       does nothing until you trigger a new deploy
     → trigger a fresh web deploy → now LIVE, fully wired up

5. terraform plan  →  "No changes" — the .tf files now match
   reality exactly, so future applies stay clean
```

Notice step 1 (push) and step 3 (apply) alone are **not enough** — steps 2
and 4 are real, separate actions against the live services. This is the
piece that's easy to assume CI/CD handles for you and it doesn't, for
anything that isn't already-correct service configuration.

## 7. Cutting the safety net — removing the old code for real

Core's `NotificationService.notify()` originally did **two** things on
every call: write a `Notification` row to Core's own database (the old,
pre-split behavior) *and* publish the event to RabbitMQ. That dual-write
was intentional, temporary scaffolding — it meant the old notification
feature kept working even if the brand-new service turned out to be
broken, while the frontend was cut over to read from it instead.

Once the new service was live in production and verified end-to-end, that
scaffolding became dead weight: nothing read Core's local copy anymore, so
it was just silently wasted writes on every post/comment. Cleanup was:

- Delete `Notification` (entity), `NotificationRepository`,
  `NotificationController`, and their DTOs from Core — actually unused
  code, not "unused for now."
- Strip `NotificationService.notify()` down to *only* the publish path —
  fetch the actor/collection, build the event, publish. No local save.
- Add a **new** Flyway migration (`V5__drop_notifications.sql`) to drop the
  now-empty table. Migrations are append-only history — you can't edit
  `V4` retroactively, even though it's the one that created the table.

**Lesson:** a "temporary, keep both paths running" step during a risky
migration is good practice — but it has an expiry date. Leaving it in
"works either way" forever just means every future reader has to figure
out which path is *actually* live, and every write pays for the one
nobody reads.

## 8. What you achieved ✅

- A real service boundary: separate process, separate database, separate
  deploy — not just a renamed folder.
- An event-driven integration (RabbitMQ) that degrades safely if the broker
  is down.
- A live realtime feature (WebSocket) with a polling fallback, so a dropped
  socket never loses data.
- Diagnosed and worked around a real platform limitation (free-tier Render +
  Terraform) using the platform's own API instead of manual dashboard clicks.
- `infra/main.tf`, the live services, and `terraform state` all agree with
  each other — verified with `terraform plan` showing zero drift.
- No leftover dual-write scaffolding — Core is purely a publisher now, the
  old table and the code that wrote to it are both gone for good.

## Cheat sheet 📇

| What you change | What happens |
| --- | --- |
| Code in `services/core/` or `services/notification/` | push → CI builds/tests → triggers that service's Render deploy |
| A brand-new Render service in `infra/main.tf` | `terraform apply` (this is a CREATE — works fine) |
| A setting on an **existing** Render service (env var, build path) | direct Render API call (`PATCH`/`PUT`) — `terraform apply` will silently fail to push it on free tier |
| `NEXT_PUBLIC_*` env var | set it via API/dashboard, then **trigger a new deploy** — it's baked in at build time, not read at runtime |
| A table you need to drop | a **new** `V#__*.sql` migration (`drop table ...`) — never edit an old migration file |

## Key words

- **Service boundary** — separate process + separate database + network
  communication. Folders alone don't make a microservice.
- **Denormalization** — copying data (like a username) into an event instead
  of just referencing an ID, because the receiver can't query for it itself.
- **Best-effort / fire-and-forget** — an operation allowed to fail silently
  because the thing that triggered it must keep working regardless.
- **Message broker** — a middleman (RabbitMQ here) that lets one service
  publish something without knowing or caring who's listening.
- **Drift** — when your Terraform files no longer match what's actually
  running; `terraform plan` shows "No changes" when there's none.
- **Baked in at build time** — `NEXT_PUBLIC_*` values get compiled into the
  frontend bundle during `npm run build`, so changing the env var does
  nothing until the next build.
