# Public pages — open issues

Known gaps in the public collection/profile pages and their hybrid rendering.
All are deliberate first-version cuts, not surprises. Design writeup:
[Lesson 11](../lessons/lesson-11-public-pages-ssr.md).

## Freshness (no refresh-on-change signal yet)

The server's public copy of a page is cached per id: refreshed in the background
after 60s, never served older than **5 minutes** (`cacheLife` in
[publicApi.ts](../../web/src/lib/server/publicApi.ts)). Nothing tells the cache
when something changes, so:

- **Public → private takes up to 5 minutes to hide.** Signed-out visitors can
  still see a collection for up to 5 minutes after its owner makes it private or
  archives it. This is the one that matters most — it's privacy, not freshness.
- **Edits and new posts lag for signed-out visitors** by up to 5 minutes.
  Signed-in viewers always re-fetch, so they (and the owner) see changes at once.
- **Like and comment counts lag** the same way for signed-out visitors.

*Fix:* a refresh signal — after a save, Core calls a small Next route handler
(with a shared secret) that runs `revalidateTag(tag, { expire: 0 })` for that
collection; tag each cached entry with `cacheTag`. Doing it for visibility
changes and archives alone would close the privacy case.

## Cache lives in memory

- **Lost whenever web sleeps or redeploys.** Render's free tier sleeps the web
  service after 15 idle minutes; the next visitor rebuilds the cache and waits on
  Core (with the shell + spinner visible, then a browser fallback after 8s). *Fix:*
  a custom cache handler backed by the existing Redis (`cacheHandlers` /
  `'use cache: remote'`), or a paid always-on instance.
- **Not shared across instances.** Fine today — web runs as a single instance.

## Abuse protection

- **No rate limiting** on the four public endpoints (collection, its posts,
  comments, profile). Only the page-size cap (100) limits a scraper. *Fix:* a
  per-IP limit (Bucket4j in Core, or at the edge).

## UX gaps

- **Profiles don't list a user's public collections** — Core has no
  "collections by owner" query for other users yet (see
  [marketplace-open-issues.md](marketplace-open-issues.md)).
- **Signed-out visitors can't reach the home feed or trending** — those stay
  login-only; the collection page hides its back button for them.
- **Members-only collections are hidden from signed-out visitors** entirely,
  rather than shown as a "buy to unlock" teaser.
- **Signed-in users see their controls fill in a moment after the content**
  (hearts, follow, owner menu), because the server always renders the anonymous
  view. *Fix if it bothers:* a non-secret "logged in" marker cookie on the web
  domain, so the server can skip the anonymous render for signed-in users.

## Hosting

- **Moving web to Vercel** would make the cache durable and remove web's own
  cold start, with no code change; Core would still sleep on Render. Not worth
  it on its own today — revisit if the first-visitor wait becomes a problem.
- Existing PUBLIC collections became readable by anyone on the internet when
  this shipped ("public" used to mean "public to DanNest users"). No opt-in was
  added.
