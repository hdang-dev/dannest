# Lesson 5 — Redis, and a real refresh-token flow (from zero)

This is the "how do you actually log someone out" lesson. It turns out the
answer, with plain JWTs, is: you can't. Fixing that is what pulls Redis into
the project.

## 1. The problem we actually had

[Lesson 3](lesson-3-google-auth.md) built a **stateless** backend: one JWT,
signed, valid for 7 days, checked purely by its signature. No session, no
database lookup, nothing to remember. That's fast and simple — and it has a
real gap: **the backend has no way to say "no" to a token it already
signed.** `POST /auth/logout` didn't even exist; "logging out" was just the
frontend deleting the token from `localStorage`. The token itself was still
completely valid, for up to 7 more days, to anyone who still had a copy.

```
Old flow:
  login → one JWT (7 days) → sent on every request → checked by signature only
  "logout" → frontend deletes it locally → backend never knew, never cared
```

That's the bug we're fixing. Not "add caching" — **add the ability to
actually revoke a session.**

## 2. The fix: two tokens instead of one

| Token | What it is | Lives how long | Checked how |
| --- | --- | --- | --- |
| **Access token** | Same as before — our signed JWT | 15 minutes | Signature only (stateless, unchanged) |
| **Refresh token** | New — a random opaque string, *not* a JWT | 30 days | Looked up in **Redis** |

The access token keeps doing exactly what it did before — it's just short-lived
now, so a leaked one self-expires fast instead of staying dangerous for a
week. The refresh token is the new piece, and it's the one thing the backend
actually tracks, so it's the one thing the backend can revoke.

```
Redis key:   refresh:<token>  →  value: userId   (TTL 30 days)
```

Losing this data on a Redis restart just logs people out — not a real loss,
which is exactly the kind of data Redis is good for (see the "what to
cache/store" discussion that led here — nothing here is written to Postgres).

## 3. The whole flow 🔁

```
Login (Google, unchanged from Lesson 3)
   → backend mints an access token (JWT) AND a refresh token
   → access token: returned in the JSON body
   → refresh token: written to Redis, AND set as an httpOnly cookie
     (JS can never read this cookie — closes the XSS-steals-the-token hole)

Every API call
   → Authorization: Bearer <access token>   (unchanged)

Access token expires (15 min)
   → frontend calls POST /auth/refresh   (browser sends the cookie automatically)
   → backend looks up the refresh token in Redis
   → found?  →  issue a NEW access token AND a NEW refresh token,
                delete the old Redis key   ("rotation" — see §5)
   → not found / expired?  →  401, user has to log in again

Logout
   → POST /auth/logout
   → backend deletes the Redis key  →  refresh token is dead, immediately
   → old access token still works for up to 15 more min and then dies on
     its own — an acceptable, bounded window
```

## 4. The pieces (and what each is)

| Piece | What it is | Where |
| --- | --- | --- |
| `JwtService` | Mints the access token only now (renamed `createAccessToken`) | `services/core/.../auth/JwtService.java` |
| `RefreshTokenService` | Issue / rotate / revoke refresh tokens in Redis | `services/core/.../auth/RefreshTokenService.java` |
| `AuthController` | Orchestrates both tokens + the cookie; `/auth/google`, `/auth/refresh`, `/auth/logout` | `services/core/.../auth/AuthController.java` |
| `SecurityConfig` | `/auth/refresh` and `/auth/logout` are `permitAll` — they run on the cookie, not the access token | `services/core/.../config/SecurityConfig.java` |
| `token.ts` | Access token, in **memory only** now — not `localStorage` | `web/src/lib/token.ts` |
| `api.ts` | On a 401: tries one silent `/auth/refresh`, retries once, *then* gives up | `web/src/lib/api.ts` |
| `auth.tsx` | On page load: calls `/auth/refresh` to restore the session (memory was wiped by the reload) | `web/src/lib/auth.tsx` |

## 5. "Rotation" — why the refresh token changes every time it's used

A naive design would reuse the same refresh token for all 30 days. We don't:
every successful `/auth/refresh` call deletes the old Redis key and issues a
brand new token.

```java
public Rotated validateAndRotate(String token) {
    String userId = redis.opsForValue().get(KEY_PREFIX + token);
    if (userId == null) {
        throw new InvalidTokenException("Refresh token is invalid or expired");
    }
    redis.delete(KEY_PREFIX + token);           // old one is dead now
    String newToken = issue(UUID.fromString(userId));  // new one takes its place
    return new Rotated(UUID.fromString(userId), newToken);
}
```

Why bother? A refresh token is only useful for 30 days, so it's a much
juicier target than a 15-minute access token. Rotation means **a refresh
token only works once.** If it's ever stolen (leaked log, XSS that somehow
still got it, whatever), the thief and the real user are now racing to use
the same token — whoever refreshes first "wins" and the other one's next
refresh attempt fails with a 401 they didn't cause. That failure is itself a
signal something's wrong (out of scope here, but the hook for "force-logout
everywhere" already exists: it's just deleting all of that user's Redis
keys).

## 6. Cookie details that actually mattered

```java
ResponseCookie.from(cookieName, token)
    .httpOnly(true)              // JS can never read this — closes the XSS hole
    .secure(cookieSecure)        // HTTPS only in prod
    .sameSite(cookieSameSite)    // see below
    .path("/api/v1/auth")        // browser only sends it to auth endpoints, nowhere else
    .maxAge(maxAgeSeconds)
    .build();
```

**`SameSite` had to differ between local dev and prod**, and it wasn't
obvious why at first:

- **Local dev**: frontend `localhost:3000`, backend `localhost:8090` — different
  ports, but browsers treat that as the *same site* (site = registrable
  domain, not port). `SameSite=Lax` works fine over plain `http`.
- **Production**: frontend and backend are two different Render subdomains
  (`dannest-punh.onrender.com` vs `dannest-service-jauh.onrender.com`).
  `onrender.com` itself is on the public suffix list, so each subdomain
  counts as its own site — this is genuinely **cross-site**. That requires
  `SameSite=None`, and browsers refuse `SameSite=None` without `Secure`
  (HTTPS) at the same time.

Both are env-driven (`JWT_REFRESH_COOKIE_SECURE`, `JWT_REFRESH_COOKIE_SAME_SITE`)
so local dev and prod each get the right setting without any code branching.

## 7. The Upstash gotcha

Provisioning Redis for production surfaced one more thing worth writing
down: Upstash's console shows `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` front and center — those are for the **HTTP REST
API** (built for serverless/edge runtimes that can't open raw TCP). Spring's
Redis client (Lettuce, via `spring-boot-starter-data-redis`) speaks the
**native Redis protocol** instead, which needs a host/port/password, not a
REST token — and there's no separate "password" field shown anywhere.

The resolution: **Upstash's Token *is* the Redis password.** Same
credential, two different access methods. So the actual values were:

```
REDIS_HOST = <the same host from UPSTASH_REDIS_REST_URL, no https://>
REDIS_PORT = 6379
REDIS_PASSWORD = <the value from UPSTASH_REDIS_REST_TOKEN>
```

**Lesson:** when a managed service's dashboard is clearly optimized for one
access pattern (here: REST, for serverless), don't assume the other
access pattern (here: plain TCP) is unsupported just because it's not the
first thing shown. It's usually one tab or one doc page away.

## 8. What you achieved ✅

- A real logout: `/auth/logout` actually revokes the session server-side,
  instead of just hiding the token from the UI.
- A short blast radius: a leaked access token is only dangerous for 15
  minutes, not 7 days.
- A refresh token that's unreadable by JS (`httpOnly` cookie) and single-use
  (rotation) — closing both the "XSS reads localStorage" and "stolen
  long-lived token" holes at once.
- Redis wired into local dev (`docker-compose.yml`) and production
  (Upstash, via `infra/`), used for exactly one thing so far — no caching
  yet, on purpose.
- Verified end-to-end twice: a scripted smoke test against the raw
  endpoints (issue → rotate → reuse-fails → revoke), and a real browser
  Google-login/reload/logout pass.

## Cheat sheet 📇

| What you want | Where |
| --- | --- |
| Change access token lifetime | `JWT_ACCESS_EXPIRATION_SECONDS` env var |
| Change refresh token lifetime | `JWT_REFRESH_EXPIRATION_SECONDS` env var |
| Force-logout a single session | `DEL refresh:<token>` in Redis (what `/auth/logout` does) |
| Force-logout a user everywhere | Not built yet — would mean tracking all of a user's active refresh-token keys, not just one |
| See active sessions locally | `docker exec dannest-redis redis-cli KEYS "refresh:*"` |
| Local Redis container | `redis` service in root `docker-compose.yml`, port 6379, no auth, no volume |

## Key words

- **Stateless vs. stateful auth** — a plain JWT is stateless (nothing to
  look up); a refresh token backed by Redis is stateful (there's now
  something to look up, and therefore something to revoke).
- **Access token / refresh token** — short-lived token used on every
  request vs. long-lived token used only to mint new access tokens.
- **Token rotation** — issuing a new refresh token (and killing the old
  one) every time the old one is used, so each one is single-use.
- **httpOnly cookie** — a cookie JavaScript cannot read, only the browser
  sends it automatically with requests.
- **SameSite** — controls whether a cookie is sent on cross-site requests;
  `None` (+ `Secure`) is required when frontend and backend are on
  different sites, `Lax` is enough when they're not.
- **TTL (time to live)** — how long a Redis key lives before it's deleted
  automatically; used here instead of writing cleanup code.
