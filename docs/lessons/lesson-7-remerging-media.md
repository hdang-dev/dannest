# Lesson 7 — Folding media back into Core

[Lesson 4](lesson-4-microservices.md) split two things out of the monolith:
**notifications** and, a bit later, **media** (image upload/crop/delete —
`services/media`, Express + MongoDB + Cloudflare R2). The notification split
earned its keep. The media split didn't, and this lesson is about undoing it —
the reasoning, and the reverse-migration mechanics, which are trickier than the
split was.

The one-line takeaway: **a service boundary is a bet you place with limited
information, not a ratchet you can only turn one way.** Revisiting one when it
stops paying off is normal maintenance, not an admission of failure.

## 1. Why the media split stopped making sense

The split was always justified as *practice* — the same "the payoff is the
learning, not a performance win" rationale [Lesson 4](lesson-4-microservices.md)
§1 gives for the notification split. That was honest, and it did teach a polyglot
stack (Express/TypeScript/MongoDB next to two Spring Boot apps), a second
out-of-band deploy, and the denormalized-snapshot pattern. But once those lessons
landed, the boundary was pure cost:

| What a real service boundary should buy | What media actually needed |
|---|---|
| Independent scaling | No — upload traffic is a rounding error next to feed reads |
| Independent deploy cadence | No — media code changed maybe twice after the split |
| A team/ownership boundary | No — solo project |
| Fault isolation | Marginal — and the denormalized snapshot already gives it |
| An event contract other services consume | **None** — nothing subscribes to media events; there are none |

Notification has a real reason to exist: it *consumes a stream* and pushes it
live. Media just took an HTTP request and wrote a row. Splitting a request/response
CRUD surface across a network buys you an extra failure mode, an extra DB to run,
an extra Docker image to build, an extra Render service to keep awake, an extra
`.env` to document — and buys back nothing.

The trigger to act now: the next chunk of work (a coin/marketplace feature with a
proper Saga) is going to churn the backend a lot. Every service boundary that
churn has to cross makes it slower and noisier. Retiring the one boundary that
isn't paying rent *before* starting is cheaper than dragging it along.

## 2. Revert or re-create? Re-create.

`git revert` of the split commit was not viable:

- Three commits landed on top of it — one **widened the media-id columns** to
  `varchar(64)` with its own migration (V8), one **rewrote `PostService` by
  ~140 lines** (feed cache), one touched it again (activity log).
- The split had **moved** `com.dannest.media.ImageCrop` →
  `com.dannest.common.ImageCrop`; later code imports the new location.

A revert would have conflicted in ~15 files and tried to restore code that no
longer fits its surroundings. Instead: bring the pre-split Java back by hand
(the Express service was a near 1:1 port of it, so the shape was well
preserved), adapted to current conventions.

## 3. Migrations are append-only — even the undo

V7 dropped the `media` table; V8 widened the `*_media_id` columns from `uuid` to
`varchar(64)` (the media service used Mongo ObjectIds). You can't edit V7 or V8 —
they've run in production. So the "undo" is a **new** forward migration, `V9`,
that:

- **recreates `media`** with a `uuid` primary key, its own `crop_*` columns, and
  a soft-delete `deleted_at` — the pre-split shape.
- **leaves `users` / `collections` / `post_media` completely alone.** The
  denormalized `*_url` / `*_crop_*` columns V7 added stay. The `*_media_id`
  columns stay `varchar(64)` — no FK re-added.

Why no foreign key back? Production rows currently hold Mongo ObjectIds that
won't match any new `media.id`. Adding an FK would fail on that existing data,
and the whole point of the denormalized snapshot is that a reference that
doesn't resolve *still renders*. New uploads get Core-generated UUID ids; old
attachments keep working off their snapshot; nothing needs a migration backfill.

```
V7  drop table media                     (media → its own service)
V8  *_media_id: uuid → varchar(64)        (Mongo ObjectIds don't fit uuid)
V9  create table media (uuid pk)          (media → back in Core)
    …and that's it. No column on users/collections/post_media changes.
```

## 4. The denormalized snapshot: kept on purpose

The obvious question after re-merging: media is in the same database now, so
delete the `post_media.url` copy and just `JOIN media`?

No. The snapshot started as a cross-service necessity but it's still worth
keeping for two reasons that have nothing to do with service boundaries:

- **Feed and profile reads stay join-free.** `PostService.list` already does a
  `findAllById` + live like/comment counts; adding a media join per row is work
  the snapshot avoids.
- **A soft-deleted media row never breaks an existing attachment.** The post
  still shows its image because the URL lives on `post_media`, not behind a
  `deleted_at IS NULL` filter on `media`.

So `media` is written on upload/crop/delete and **never read on the render
path** — same property the split gave it, minus the network hop.

## 5. What actually changed

**Code**
- New `com.dannest.media` package: `Media` entity, `MediaController`
  (`POST /api/v1/media`, `/external`, `PATCH /{id}`, `DELETE /{id}`),
  `MediaService`, `R2Config` (S3 SDK pointed at R2), `R2Properties`.
- `build.gradle`: `software.amazon.awssdk:s3` back (BOM `2.28.29` — 2.30+ sends
  request checksums R2 rejects).
- `application.yml`: `storage.r2.*` back; `application-local.yml.example` back.
- `V9__media_back_into_core.sql`.
- `services/media/` deleted entirely.

**Web**
- One base URL, not two: `media.ts` calls go to `NEXT_PUBLIC_API_URL` like
  everything else. `MEDIA_API_URL` and `NEXT_PUBLIC_MEDIA_API_URL` deleted from
  `config.ts` and the Dockerfile.

**Infra**
- `infra/main.tf`: `render_web_service.media` gone; `R2_*` env vars moved back
  onto the `backend` service; `mongo_uri` variable gone.
- `docker-compose.yml`: `mongo-media` container + its volume gone.
- MongoDB Atlas: no longer used by anything. Cloudflare R2: now Core's.

**CI/CD**
- `deploy.yml`: the `media` path filter and the `check-media` / `build-media` /
  `deploy-media` jobs deleted. `rollback.yml`: `media` removed from the choices.

**Production cutover** (mirror of [Lesson 4](lesson-4-microservices.md) §6, run
in reverse):
1. Merge — CI builds Core with the media code; deploys it. Uploads now work on
   Core, but nothing calls them yet.
2. `PUT` the `R2_*` env vars onto the Core service via Render's API (free-tier
   can't do it through `terraform apply` — [Lesson 4](lesson-4-microservices.md)
   §5), trigger a redeploy.
3. Rebuild web without `NEXT_PUBLIC_MEDIA_API_URL` → media calls hit Core.
4. Once verified, delete the `dannest-media` Render service and the Atlas
   database by hand.
5. `terraform plan` → "No changes".

## 6. What you achieved ✅

- Removed a service boundary cleanly: one deploy target fewer, one database
  engine fewer, one CI pipeline fewer — with zero data migration on the
  referencing tables.
- A forward-only "undo" migration (`V9`) that coexists with the split
  migrations (`V7`, `V8`) instead of pretending they didn't happen.
- Kept the denormalized-snapshot read model on its own merits after its
  original (cross-service) reason went away.
- Practised the judgement call itself: **microservices is not monotonic.**

## Cheat sheet 📇

| Situation | Split it out? |
|---|---|
| It consumes an event stream / has async work | Maybe — notification did |
| It needs to scale or deploy on a different cadence | Maybe |
| It's a request/response CRUD surface over one table | **No** — that's what media was |
| "It would be good practice" | Once. Then re-evaluate like anything else. |

| Undoing a split | Do this |
|---|---|
| Old migrations that dropped/altered tables | Leave them. Write a new forward migration. |
| Referencing columns changed type/lost FKs | Leave them if they still work. Don't re-tighten over existing data. |
| The `git revert` route | Only if nothing landed on top. Usually re-create by hand. |
| Prod cutover | Same steps as the split, reversed — and the free-tier Render API caveat still applies. |

## Key words

- **Service boundary as a bet** — you draw it with partial information; new
  information (usage, churn, what it actually taught) can change the answer.
- **Forward-only migrations** — the fix for a bad schema change is another
  change, never an edit to history. The undo of a split is itself a migration.
- **Read model vs source of truth** — `media` is the source of truth for an
  asset; the `*_url`/`*_crop_*` columns are a read model. They can outlive the
  reason they were introduced.
- **Monotonic assumption** — treating "we split X out" as permanent. It isn't;
  merging back is ordinary maintenance.
