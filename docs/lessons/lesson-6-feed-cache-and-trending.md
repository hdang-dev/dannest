# Lesson 6 — Feed caching, a leaderboard, and a fix we didn't need

This lesson covers three real additions — two new notification types riding
the existing RabbitMQ pipe, a Redis cache on the public feed, and a
Redis-backed trending leaderboard — plus one thing that got **built and then
deleted on purpose**. That last part is worth reading even if you skip the
rest: catching over-engineering before it ships is as much a skill as
building the feature in the first place.

## 1. Two new notification types, zero new infrastructure

[Lesson 4](lesson-4-microservices.md) built the RabbitMQ pipe for `NEW_POST`
and `COMMENT_REPLY`. Two gaps sat unfixed after that: a collection owner had
**no way at all** to learn someone followed them (no follower list, no
count, nothing), and a post's author got no signal in the moment someone
liked it.

Both are the exact same shape of event the pipe already handles — "tell
someone something happened" — so adding them was additive, not architectural:

```java
// FollowService.follow(), inside the existing idempotency guard
notificationService.notify(collection.getOwnerId(), userId, NotificationType.FOLLOW, collectionId, null, null);

// PostService.like(), inside the existing idempotency guard
notificationService.notify(post.getAuthorId(), userId, NotificationType.POST_LIKED, post.getCollectionId(), post.getId(), null);
```

Two small ripples on the Notification side: `post_id` was `NOT NULL` on the
`notifications` table because every event used to have one — `FOLLOW`
doesn't, so [V2\_\_nullable_post_id.sql](../../services/notification/src/main/resources/db/migration/V2__nullable_post_id.sql)
relaxes that. And `message()`/`targetUrl()` are exhaustive `switch`
expressions with no `default` — the compiler itself forced both new cases
to be handled, which is exactly the point of writing them that way.

**One honest trade-off, shipped anyway**: `POST_LIKED` has no batching. A
post liked 10 times fires 10 separate pushes. Real apps solve this with
aggregation ("A and 4 others liked your post") — that's real work, out of
scope here, and worth knowing about before it gets annoying in practice.

## 2. The feed's actual hot path — and what *not* to cache

The public feed (`scope=FEED`) is the one page every visitor hits, and it
re-runs the same filter query + `COUNT(*)` against Postgres on every single
load. The tempting fix is to cache the whole rendered page. **Don't** — a
feed page contains "did *I* like this," which is different per user and
must never come from a shared cache, or you could see your own like vanish
for a few seconds after clicking it.

The actual fix: cache only the *shared, expensive* part — which post ids
belong on this page, and the total count — and always compute the *personal,
cheap* part live:

```java
// cached: {postIds, totalElements, totalPages, last} — no likedByMe, no counts
// on every read, hit or miss:
List<Post> ordered = postRepository.findAllById(cached.postIds())...; // re-sorted to match
toResponses(ordered, userId); // counts + likedByMe computed fresh, every time
```

`likeCount`/`commentCount` in the cached path are just as live as
`likedByMe` — this isn't "cache everything except likes," it's "cache the
id list, hydrate everything else the same way it already worked." Nothing
here can ever go stale, because nothing personal or count-shaped is ever
stored in Redis.

Invalidation is equally simple: `PostService.create()` deletes every
`feed:posts:v1:*` key, because a new post changes page 0 and every total
count. Likes and comments never touch the cache at all — they were never
part of what's stored, so there's nothing to invalidate. A 20s TTL
(`FEED_CACHE_TTL_SECONDS`) exists only as a self-healing safety net between
explicit evictions, not as something correctness depends on.

## 3. A sorted set, for real this time

Every Redis use so far ([Lesson 5](lesson-5-redis-refresh-tokens.md), and
§2 above) was a plain key/value. Trending posts is the first place a Redis
**data structure** actually earns its keep: a sorted set (`ZSET`) keeps a
small collection ranked by score, with O(log N) inserts and "give me the
top N" reads that need no scanning.

```
someone likes a post     → ZINCRBY trending:posts +1 {postId}
someone comments on it   → ZINCRBY trending:posts +2 {postId}
someone unlikes it       → ZINCRBY trending:posts -1 {postId}
post gets deleted        → ZREM trending:posts {postId}
reading the leaderboard  → ZREVRANGE trending:posts 0 9   (top 10)
```

This one deliberately **doesn't** go through RabbitMQ. The activity that
feeds it (likes, comments) already happens inside `core`'s own request
path — publishing an event just so `core` could consume it back would be a
pointless self-hop. RabbitMQ is for telling *other services* something
happened; this never leaves the process.

The `+1`/`+2` weights are placeholders, not derived from any real data —
comments feel like a stronger signal than likes, but there's nothing behind
those specific numbers. And there's **no time decay**: a post liked 100
times last year permanently outranks one liked 10 times today, forever,
unless someone starts unliking the old one. Both are known, accepted gaps
for a first pass, not oversights — worth fixing later if the leaderboard
turns out to matter, not before.

## 4. The one we built and then deleted

Notification's WebSocket push (`WebSocketConfig.enableSimpleBroker`) only
holds sessions in the JVM's own memory. Run Notification as **two**
instances and a real bug appears: RabbitMQ hands an event to whichever
instance is free, that instance saves the notification fine (shared
Postgres), but its live push only reaches clients connected to *that same
instance* — a client on the other instance gets nothing live (though
they'd still see it on next reload).

The fix — publish the notification to a Redis channel every instance
subscribes to, so whichever instance actually holds the client's session
is the one that delivers it — got fully built: a new `RedisConfig`, a
`NotificationPushListener`, a new `spring-boot-starter-data-redis`
dependency on a service that didn't have one, `NotificationService`
rewired to publish instead of pushing directly. It compiled, it passed
every test, it was correct.

**Then it got deleted**, because Notification runs as exactly one instance
in production, with no plan to change that. The bug this fixes literally
cannot occur with one instance — there's only one process, so the RabbitMQ
consumer and every WebSocket session are always the same one. Keeping the
fix anyway would have meant a new dependency on Redis being healthy for a
push path that previously didn't need Redis at all, in exchange for a
behavior difference of zero.

**Why write this down instead of just quietly reverting it**: this is what
YAGNI ("you aren't gonna need it") looks like from the inside — not a
principle you apply *before* writing code, but a judgment call you're
allowed to make *after*, once code that works turns out to solve a problem
you don't actually have. Nothing about the design is lost — it's written
down here, so it doesn't need rediscovering from scratch if a second
instance ever becomes real — it's just not running as live code until then.

## 5. What you achieved ✅

- `FOLLOW` and `POST_LIKED` notifications, riding the exact pipe `NEW_POST`
  and `COMMENT_REPLY` already proved out — zero new infrastructure.
- A feed cache that can never serve stale personal data, because personal
  data was never what got cached.
- A working trending leaderboard, and your first real use of a Redis data
  structure beyond key/value.
- Practice recognizing (and reverting) infrastructure built for a problem
  that doesn't exist yet — arguably the most useful outcome of the four.

## Cheat sheet 📇

| What you want | Where |
| --- | --- |
| Add a new notification type | `NotificationType` in **both** services (names must match — `NotificationType.valueOf(event.eventType())`) + `message()`/`targetUrl()` switches in Notification |
| Change feed cache TTL | `FEED_CACHE_TTL_SECONDS` env var |
| Force a feed cache miss | `redis-cli DEL $(redis-cli KEYS 'feed:posts:v1:*')` |
| Change trending weights | `TrendingScoreService`'s `incrementLike`/`incrementComment` |
| Inspect the leaderboard | `redis-cli ZREVRANGE trending:posts 0 -1 WITHSCORES` |
| Change trending page size | `limit` query param on `GET /api/v1/posts/trending`, defaults to 10 |

## Key words

- **Sorted set (ZSET)** — a Redis data structure keeping members ranked by
  a numeric score, with cheap top-N reads (`ZREVRANGE`) and cheap score
  updates (`ZINCRBY`) — the right tool whenever you need "top N of
  something," not just a key/value cache.
- **Cache what's shared, compute what's personal** — the core lesson of
  §2: a cache is safe exactly as far as its contents are the same for
  every reader; the moment something is per-user, it doesn't belong in the
  shared cache entry at all.
- **Competing consumers** — RabbitMQ's default behavior when multiple
  processes consume the same queue: each message goes to exactly one of
  them, load-balanced arbitrarily. This is what guarantees a notification
  is only saved once even with multiple instances — and also exactly why
  a *push* built on top of it can reach the wrong instance (§4).
- **YAGN(now)** — the discipline in §4: it's fine to build something to
  find out whether you need it, as long as you're also willing to delete
  it once you learn you don't.
