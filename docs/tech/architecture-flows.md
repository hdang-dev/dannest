# 01 — Architecture

Everything DanNest is built from: our own services, the third-party services
they depend on, how they all talk to each other, and — for our own code
only — which libraries do the work.

---

## 1. All services & roles

### Ours

| Service | Role |
|---|---|
| **web** | Next.js frontend. The only thing users directly load in a browser. Talks to both backend APIs directly. |
| **services/core** | Main backend API — auth, users, collections, posts, comments, follows, and media (image upload/crop/delete, the only service that talks to Cloudflare R2). Owns its own Postgres DB. Publishes events when something happens. |
| **services/notification** | Small backend API dedicated to notifications only. Owns a *separate* Postgres DB. Consumes events from Core and pushes them live over WebSocket. |

> Media was briefly a third service (`services/media`, Express + MongoDB); it was
> folded back into Core — see [Lesson 7](../lessons/lesson-7-remerging-media.md).

### Third-party / managed

| Service | Role |
|---|---|
| **Google Sign-In** | Identity provider. User logs in with Google in the browser; the frontend sends the resulting ID token to Core, which verifies it with Google once, then never talks to Google again for that session. |
| **Neon** | Managed Postgres. Hosts two separate databases — one for Core, one for Notification. |
| **CloudAMQP** | Managed RabbitMQ. The message broker Core publishes events to and Notification consumes from. |
| **Upstash** | Managed Redis. Used only by Core: refresh tokens (revocable sessions), the public feed's page cache, and the trending-posts sorted set. Notification does **not** use Redis — see [Lesson 6](../lessons/lesson-6-feed-cache-and-trending.md) §4 for why a Redis-backed fix there was built and then deliberately reverted. |
| **Cloudflare R2** | S3-compatible object storage. Used only by Core, to store uploaded media (images) — accessed via the AWS S3 SDK pointed at R2's endpoint. |
| **Render** | PaaS hosting for all three of our services (web, core, notification). Runs health checks, serves the live URLs. |
| **GitHub Actions** | CI/CD. On every push, checks whichever service(s) changed, builds a Docker image, pushes it to GHCR, then tells Render to deploy that exact image. |
| **GHCR** | GitHub Container Registry. Holds the Docker images GitHub Actions builds, tagged by commit SHA — Render only ever pulls from here, it never builds from source. |
| **Terraform** | Infrastructure-as-code tool (not a runtime service) that defines the Render resources above declaratively, in [infra/main.tf](../../infra/main.tf). |

### How they interact

```mermaid
flowchart TD
    Google["Google Sign-In"]
    Web["web\n(Next.js)"]
    Core["core\n(Spring Boot)"]
    MQ["CloudAMQP\n(RabbitMQ)"]
    Notif["notification\n(Spring Boot)"]
    NeonCore[("Neon Postgres #1\ncore DB")]
    Redis[("Upstash Redis\nrefresh tokens")]
    R2[("Cloudflare R2\nmedia bytes")]
    NeonNotif[("Neon Postgres #2\nnotification DB")]
    Render["Render"]
    GHA["GitHub Actions"]
    GHCR[("GHCR\n(Docker images)")]
    TF["Terraform"]

    Google -- "ID token (login only)" --> Web
    Web -- "REST (JWT)" --> Core
    Web -- "REST (JWT) + WebSocket" --> Notif
    Core -- "publish event\ndannest.events" --> MQ
    MQ -- "consume event" --> Notif
    Notif -. "WebSocket push (live)" .-> Web
    Core --> NeonCore
    Core --> Redis
    Core -- "S3 API" --> R2
    Notif --> NeonNotif
    GHA -- "build + push image" --> GHCR
    GHA -- "deploy exact image" --> Render
    Render -- "pulls image" --> GHCR
    TF -- "provisioned" --> Render
    Render -. hosts .-> Web
    Render -. hosts .-> Core
    Render -. hosts .-> Notif
```

*(Rendered by any Mermaid-aware Markdown viewer — VS Code's built-in preview
and GitHub both support it. If yours shows raw text instead of a diagram,
tell me and I'll switch formats.)*

`core` and `notification` never call each other directly and never share a
database — the RabbitMQ event above is the only link between them. `web` is the
only thing that talks to both backend services directly.

Plain-English version:

1. User logs into **web** via **Google Sign-In**.
2. **web** sends that Google token to **core**, which verifies it with Google once and issues DanNest's own JWT.
3. **web** uses that JWT for every REST call to **core** and **notification**.
4. **core** stores its data in its own **Neon** Postgres, refresh tokens + caches in **Upstash** Redis, and uploaded image bytes in **Cloudflare R2** (via the S3 API).
5. Whenever something notification-worthy happens, **core** publishes an event to **CloudAMQP** (RabbitMQ). It doesn't know or care who's listening.
6. **notification** consumes that event, saves it to its own **Neon** Postgres, and pushes it live to **web** over a WebSocket.
7. **core** and **notification** never call each other directly and never share a database.
8. All three of our services are hosted on **Render**; **GitHub Actions** builds and pushes a Docker image to **GHCR** on every push, then tells Render to deploy that exact image; **Terraform** is what originally provisioned the services on Render.

---

## 2. Libraries in our own services

### web (Next.js)

| Library | What it's for |
|---|---|
| `next` | The framework — routing, dev server, build/bundling. |
| `react` / `react-dom` | UI rendering. |
| `typescript` | Static typing across the app. |
| `@stomp/stompjs` | STOMP protocol client, for the live notification WebSocket. |
| `sockjs-client` | WebSocket transport (with fallback) that STOMP rides on. |
| `react-easy-crop` | Image cropping UI before uploading media. |
| `tailwindcss` | Utility-class CSS styling. |
| `eslint` | Linting (dev-time only, no runtime role). |

### services/core (Spring Boot)

| Library | What it's for |
|---|---|
| `spring-boot-starter-web` | REST controllers, embedded server, JSON handling. |
| `spring-boot-starter-validation` | `@Valid` request validation. |
| `spring-boot-starter-security` + `-oauth2-resource-server` | Issues and verifies our own JWTs (HS256). |
| `google-api-client` | Verifies the Google Sign-In ID token at login. |
| `spring-boot-starter-data-jpa` | ORM (Hibernate) + repository interfaces. |
| `postgresql` (JDBC driver) | Lets JPA talk to Postgres. |
| `flyway-core` / `flyway-database-postgresql` | Versioned SQL schema migrations. |
| `spring-boot-starter-data-redis` | Redis client — refresh tokens, the public feed's page cache, and the trending-posts leaderboard (sorted set). |
| `spring-boot-starter-amqp` | RabbitMQ client — publishes domain events. |
| `software.amazon.awssdk:s3` | S3-compatible client, pointed at Cloudflare R2 for media uploads. Pinned via BOM 2.28.x (2.30+ sends request checksums R2 rejects). |
| `lombok` | Generates getters/setters/builders, less boilerplate. |
| `mapstruct` | Generates entity ↔ DTO mapping code. |
| `spring-boot-starter-actuator` | Health check endpoint (`/actuator/health`) for Render. |

### services/notification (Spring Boot)

Shares most of Core's stack (web, security/JWT verification, data-jpa,
Postgres driver, Flyway, amqp, Lombok, MapStruct, actuator) for the same
reasons, minus Redis/AWS/Google (not needed here), plus one addition:

| Library | What it's for |
|---|---|
| `spring-boot-starter-websocket` | STOMP-over-WebSocket support — pushes live notifications to connected browsers. |

---

## 3. Flows / Use Cases

Concrete, end-to-end walks through the system above — each one names the
actual endpoint/class involved so you can jump into the code.

### a) Login with Google

```mermaid
sequenceDiagram
    participant U as Browser
    participant W as web
    participant G as Google Sign-In
    participant C as core
    participant R as Upstash Redis

    U->>W: Click "Sign in with Google"
    W->>G: Google OAuth popup
    G-->>W: ID token
    W->>C: POST /api/v1/auth/google { idToken }
    C->>G: verify ID token (one-time, GoogleTokenVerifier)
    C->>C: find or create User
    C->>C: sign access JWT, HS256 (JwtService)
    C->>R: store refresh token (RefreshTokenService)
    C-->>W: 200 { accessToken } + Set-Cookie (httpOnly refresh)
    W->>W: keep accessToken in memory only (token.ts)
```

Access token lives in memory on the frontend — gone on page reload by
design. The refresh token is the httpOnly cookie, scoped to `/api/v1/auth`.

### b) Silent refresh (access token expired, session isn't)

```mermaid
sequenceDiagram
    participant W as web (apiFetch)
    participant C as core
    participant R as Upstash Redis

    W->>C: GET /api/v1/... (Bearer accessToken)
    C-->>W: 401 (expired)
    W->>C: POST /api/v1/auth/refresh (cookie sent automatically)
    C->>R: validate + rotate refresh token
    C-->>W: 200 { new accessToken } + Set-Cookie (new refresh)
    W->>C: retry original request (new Bearer)
    C-->>W: 200 { data }
```

The refresh token is single-use (rotated every call), so [api.ts](../../web/src/lib/api.ts)
coalesces concurrent refresh attempts into one in-flight request — otherwise
a losing second call would kill a session the first call just restored. If
the refresh cookie itself is missing/expired, `core` returns 401 again and
`web` logs the user out for real.

### c) Create a post → followers get notified live

```mermaid
sequenceDiagram
    participant W as web (author)
    participant C as core
    participant DB1 as Neon (core DB)
    participant MQ as CloudAMQP
    participant N as notification
    participant DB2 as Neon (notification DB)
    participant W2 as web (follower)

    W->>C: POST /api/v1/posts { collectionId, title, ... }
    C->>DB1: save Post (PostService.create)
    C->>DB1: find followers of the collection
    loop each follower
        C->>MQ: publish DannestEvent(NEW_POST) → "dannest.events"
    end
    C-->>W: 201 PostResponse
    MQ->>N: deliver event (queue bound with # wildcard)
    N->>DB2: save Notification
    N-->>W2: WebSocket push → /topic/notifications/{followerId}
```

`core` never waits on this — publishing is fire-and-forget
([NotificationService.java](../../services/core/src/main/java/com/dannest/notification/NotificationService.java)
in `core`, not to be confused with the whole `notification` service). It
also enforces "never notify yourself": if `recipientId == actorId` it's a
no-op. `COMMENT_REPLY` (replying to someone's comment), `FOLLOW`
(following a collection), and `POST_LIKED` (liking a post) all follow the
exact same shape — only the trigger and recipient differ
(`CommentService.java` notifies the parent comment's author,
`FollowService.java` notifies the collection owner, `PostService.java`
notifies the post's author).

### d) Upload a post image, attach it to the post

Media upload and post creation are still **two calls from `web`** — one to
`/api/v1/media`, one to `/api/v1/posts` — even though both hit `core` now.
Keeping them separate means the cropper can upload as soon as the user picks a
file, and `core` still stores the id plus a denormalized `url`/crop snapshot on
`post_media` rather than joining to `media` on every read — see
[db-schema.md](db-schema.md)'s *Image crop* section.

```mermaid
sequenceDiagram
    participant W as web
    participant C as core
    participant R2 as Cloudflare R2
    participant DB1 as Neon (core DB)

    W->>C: POST /api/v1/media (multipart file + crop box)
    C->>R2: PutObject (S3 SDK → R2 endpoint)
    C->>DB1: save media row (url, crop)
    C-->>W: 201 { id, url, crop }
    W->>C: POST /api/v1/posts { images: [{mediaId, url, crop}, ...] }
    C->>DB1: save Post + post_media rows (url/crop copied in, not looked up)
    C-->>W: 201 PostResponse
```

`notification` isn't involved at all.

### e) Re-crop an already-attached image (avatar, cover, or post image)

Still two calls, because two rows change: the `media` row's `crop`, then the
owning entity's denormalized snapshot. An explicit user action (open the
cropper, hit Save) — nothing syncs the copy automatically, and nothing needs
to: the `url` doesn't change on a crop edit, only `crop` does.

```mermaid
sequenceDiagram
    participant W as web
    participant C as core

    W->>C: PATCH /api/v1/media/{id} (new crop box)
    C-->>W: 200 { id, url, crop }
    W->>C: PATCH /api/v1/users/me { avatarMediaId, avatarMediaUrl, avatarCrop }
    C-->>W: 200 UserProfileResponse
```

(Same shape for a collection's cover via `PATCH /api/v1/collections/{id}`, or
a post's images via `PATCH /api/v1/posts/{id}`.)

### f) Delete a media asset

Not yet wired into any `web` UI (`deleteMedia()` exists in
[media.ts](../../web/src/lib/media.ts) but nothing calls it — same status as
`deletePost()`). When it is, the shape is: clear the reference first (e.g.
`avatarMediaId: null`), then `DELETE /api/v1/media/{id}` (soft-delete the row,
free the R2 bytes) — that order means a failure on the second call never leaves
a row pointing at bytes that are about to disappear. `MediaService.delete` only
issues the R2 `DeleteObject` for `UPLOAD` assets, never `EXTERNAL` links.

### g) Load the public feed (Redis-cached)

Only `scope=FEED`'s default-sorted pages are cached, and only the *shared*
part — which post ids are on the page, and the total count. Per-user data
(likes, "did I like this") is never cached; it's recomputed live on every
request, hit or miss. See [Lesson 6](../lessons/lesson-6-feed-cache-and-trending.md)
§2 for why.

```mermaid
sequenceDiagram
    participant W as web
    participant C as core (PostService.list)
    participant R as Upstash Redis
    participant DB as Neon (core DB)

    W->>C: GET /api/v1/posts (scope=FEED)
    C->>R: GET feed:posts:v1:{page}:{size}:{q}
    alt cache hit
        R-->>C: {postIds, totalElements, ...}
    else cache miss
        C->>DB: filter query + COUNT(*)
        C->>R: SET feed:posts:v1:..., TTL 20s
    end
    C->>DB: findAllById(postIds) + live like/comment counts + likedByMe
    C-->>W: 200 PagedResponse<PostResponse>
```

`PostService.create()` deletes every `feed:posts:v1:*` key after saving —
a new post changes page 0 and every total count, so it can't wait out the
TTL. Likes and comments never evict anything, because the part they'd
affect was never cached to begin with.

### h) Trending posts (Redis sorted set)

A Redis ZSET (`trending:posts`), not RabbitMQ — the activity that feeds
it (likes, comments) already happens inside `core`'s own request path, so
there's no other service to hand an event to.

```mermaid
sequenceDiagram
    participant W as web
    participant C as core
    participant DB as Neon (core DB)
    participant R as Upstash Redis

    W->>C: POST /api/v1/posts/{id}/likes
    C->>DB: save PostLike
    C->>R: ZINCRBY trending:posts +1 {postId}

    W->>C: POST /api/v1/posts/{id}/comments
    C->>DB: save Comment
    C->>R: ZINCRBY trending:posts +2 {postId}

    W->>C: GET /api/v1/posts/trending?limit=10
    C->>R: ZREVRANGE trending:posts 0 9
    R-->>C: ranked post ids
    C->>DB: findAllById + visibility filter + live toResponses
    C-->>W: 200 List<PostResponse>
```

No time decay yet — scores only ever accumulate, a known limitation (see
[Lesson 6](../lessons/lesson-6-feed-cache-and-trending.md) §3).
