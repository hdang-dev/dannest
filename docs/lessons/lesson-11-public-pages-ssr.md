# Lesson 11 — Public pages and hybrid rendering

Until now every DanNest page sat behind login. That made sense for an app, but it
meant a shared collection link was useless to anyone without an account: no
content, no link preview, just a redirect to `/login`. This lesson opens
**public collections and profiles** to signed-out visitors (read-only), and uses
that as the excuse to finally use the server side of Next.js — rendering those
pages on the server, from a short-lived cache, so the first response already
contains the content.

The one-line takeaway: **server-render what's the same for everyone, and let the
browser add what's personal — the server never needs to know who's looking.**

---

## 1. SSR is about *where the HTML is built*, not about `"use client"`

The first thing to unlearn: `"use client"` does **not** mean "renders only in the
browser". Every page in DanNest was already rendered on the server — it just
rendered *empty*, because all data fetching lived in `useEffect`, which never runs
on the server. The HTML that arrived was a spinner; the posts came later.

Two separate ideas, easy to blur:

| Idea | Question it answers |
|---|---|
| **SSR** | Is the HTML built on the server before it's sent? |
| **Server vs. client component** | Does this component's *code* also ship to the browser? |

| Kind | Rendered on the server? | Code sent to the browser? | Can `await` data on the server? |
|---|---|---|---|
| Server component (no marker) | yes | no | yes |
| Client component (`"use client"`) | **yes, to HTML** | yes — then hydrates | no — `useEffect` is browser-only |

So the change wasn't "remove `use client`". It was **move the fetch to the
server**: a small server component does the `await`, then passes the data as a
prop into the existing client component, which renders it to HTML on the server
and comes alive in the browser.

And wrapping in `AuthProvider` (a client component) doesn't spoil it. What makes
something a client component is the file it's *imported into*. Nobody imports the
page — Next's router renders it on the server and passes the result down as
`children`, through `RootLayout` and into `AuthProvider`.

## 2. The server can't know who's looking — so don't ask it to

DanNest keeps the access token in browser memory, and the refresh cookie belongs
to Core's domain, scoped to `/api/v1/auth`. The Next server never sees either. So
any server render is, by construction, **anonymous**.

That sounds like a limitation; it's actually the safety guarantee. The server asks
Core with no token, Core only returns PUBLIC content to anonymous callers, so
private data can never land in the cache that every visitor shares.

How big sites handle logged-in vs. logged-out on the same URL (we looked):

| Pattern | Server needs to know the user? |
|---|---|
| Two separate experiences (logged-out = cached page, logged-in = the app) — Reddit, WordPress caches | yes, via a cookie |
| One cached page, personal bits added in the browser | **no** |
| Static shell + personal parts streamed from the server (Next PPR + cookies) | yes, via a cookie |

DanNest can only do the middle one without reworking auth — and it's the right fit
anyway. So it's **one component, two modes**: the server always renders the
anonymous view; in the browser, once the session check finishes, a signed-in
viewer re-fetches with their token and the page upgrades in place (likes fill in,
follow state, owner menu).

## 3. Core: four read endpoints open to anonymous callers

`SecurityConfig` permits `GET` without a token on exactly four paths — one
collection, its posts, a post's comments, a user profile — and every service
learned to handle a `null` viewer:

- anonymous sees **PUBLIC, non-archived** only; private, members-only and archived
  answer **404** (same "hide that it exists" rule as before);
- per-user lookups (`likedByMe`, membership) are skipped;
- page size is capped at 100, since these are now scrapeable.

Reading the code for this surfaced an old gap: comment visibility only blocked
PRIVATE, so logged-in **non-members could read comments on members-only posts**.
Comments now follow the exact same rule as posts.

### The bug the tests missed: a 404 that became a 401

Smoke-testing with `curl`, the members-only collection answered **401** to an
anonymous caller instead of 404. The cause: a `@ResponseStatus(NOT_FOUND)`
exception doesn't write the response itself — Spring calls `sendError(404)`, and
Tomcat *forwards* to `/error` to render it. That forward goes back through Spring
Security, `/error` wasn't permitted, and an anonymous request got bounced as 401.

It mattered for real: the web app treats 401 as "session expired" and would have
sent a signed-out visitor of a private collection to the login page.

The integration test passed because **MockMvc never does that `/error` forward**.
Fix: permit `/error`, and move the test to a real HTTP server
(`@SpringBootTest(webEnvironment = RANDOM_PORT)` + `TestRestTemplate`). Then check
the test actually guards it: remove the fix, watch it fail on exactly that case,
restore.

## 4. Web, part one: public pages that work without SSR at all

The feature itself needs no server rendering — it shipped first as plain
browser-rendered pages:

- `RequireAuth` removed from the collection and profile pages;
- a **sign-in prompt** (`useRequireLogin()`): like, follow, comment and reply call
  it first — signed in, the action goes ahead; signed out, a friendly dialog
  ("Hop into the nest first 🪺") offers to sign in, and login returns to the same
  page via a same-site-only `?next=`;
- while the session is still being restored, a click does nothing rather than nag
  someone who's actually signed in.

One subtle bug, caught while reading rather than testing: without the auth wall,
the page **mounts before the access token is restored**. Fetching on mount would
go out anonymous, and an owner would see "not found" on their own private
collection. So the page waits for the session check before fetching.

Splitting it this way kept "public pages" and "SSR" as two separate,
independently testable steps — the second only *adds* speed and link previews.

## 5. Web, part two: hybrid rendering (Partial Prerendering)

With `cacheComponents: true`, Next splits each page at its `<Suspense>`
boundaries into **send now** and **send when ready** — in one streamed response:

```
GET /collections/123
  │
  ├─ static shell (header + spinner)  ─────────── sent instantly
  │
  └─ inside <Suspense>:
       CollectionContent awaits params + data ─── streamed in when ready
         └─ <CollectionView initial={data}>    (client component, rendered
                                                 to HTML on the server too)
```

The page is four small functions, and the split is the point:

- `CollectionPage` (default export) returns the shell + `<Suspense>` and **must not
  `await` anything** — if it did, nothing could be sent until the data arrived
  (blank tab for up to the whole timeout), and Next flags it at build time.
- `CollectionContent` sits *inside* the boundary and does the waiting.
- `generateMetadata` builds the title and Open Graph tags (link previews). For a
  non-public collection it returns `{}`, so a private name never leaks into a
  preview.
- `loadPublic` turns any failure into `null`.

The data comes from a cached server function:

```ts
export async function getPublicCollectionWithPosts(id: string) {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 300 });
  // anonymous fetch to Core; null on 404
}
```

- **`revalidate: 60`** — after a minute, the next visitor still gets the old copy
  while a fresh one builds in the background.
- **`expire: 300`** — the hard limit. Without it, a quiet site could serve a
  30-minute-old copy to the first visitor in 30 minutes. (Under 5 minutes, Next
  treats a cache as "short-lived" and builds it per request instead — so 5 minutes
  is also the floor that keeps it a real cache.)
- **8-second timeout** — a sleeping Render service can take ~30s to wake; past 8s
  the server gives up and the browser fetches instead.

Two details that are easy to get wrong:

- **Errors must not be cached.** `loadPublic`'s `try/catch` sits *outside* the
  cached function. If the cached function caught the error itself, it would
  *return* `null` — and Next would cache that `null` for 5 minutes. A thrown error
  isn't cached, so the next request simply tries again.
- **`null` is never trusted.** "The server had nothing" can mean private, missing,
  or Core down — so the browser always fetches in that case, with the viewer's own
  token. That's how an owner still sees their private collection.

The browser-side rule, in `CollectionView`:

1. session check still running → wait;
2. signed out, and the server sent the page → don't fetch (nothing to add);
3. otherwise → fetch (signed-in viewers for their own state; everyone the server
   had nothing for).

Profiles are simpler: a profile looks the same to every viewer, so a
server-rendered one is never re-fetched.

## 6. Hydration: when server and browser disagree on purpose

On load, React re-runs the components in the browser and compares the result with
the server's HTML. A mismatch is treated as an error: React throws that part away
and re-renders it — a flicker, plus a console error. Two of our labels can
legitimately differ:

- **"5m ago"** — the server renders at 10:04:59 ("4m ago"), the browser hydrates
  at 10:05:00 ("5m ago");
- **"Joined March 2026"** — the server runs in UTC; for an account created at
  23:30 UTC on March 31, a browser in UTC+7 says April.

`suppressHydrationWarning` on those two elements tells React the difference is
expected: **keep the server's text during hydration**. It's not "never update" —
the next re-render (a like, the signed-in re-fetch) writes the current value as
usual — and it only covers that element's own text, so real mismatches elsewhere
still surface.

## 7. Proving it

Verified against a **production build** (`next build && next start`), looking at
the raw HTML a visitor or preview bot receives first:

| Request | First response |
|---|---|
| Public collection | Post titles in the HTML; `<title>Golden hour skies — DanNest</title>`; `og:image` = the cover |
| Same, as `facebookexternalhit` | Same — title, description, image |
| Private collection | No content, no preview tags, default site title |
| Any page with Core down | Shell + spinner instantly; the browser fetches instead |

`next build` marks the two routes `◐ (Partial Prerender)`; every other page stays
`○ (Static)`.

## What we did, in order

- Researched SSR vs. CSR, frameworks, and how big sites split logged-in/logged-out
  — and decided the feature (public pages) and the technique (SSR) were separate
  steps.
- Core: four anonymous read endpoints, a `null`-viewer rule in every service, a
  page-size cap, and the members-only comment gap closed.
- Caught a 404→401 bug that MockMvc couldn't see; moved the test to real HTTP and
  proved it guards the bug.
- Web: public pages + sign-in prompt + login return path, fetch-after-session-check.
- Web: hybrid rendering with `use cache`, a Suspense split, link-preview metadata,
  and a browser upgrade path for signed-in viewers.
- Wrote down the deliberate gaps in
  [public-pages-open-issues.md](../tech/public-pages-open-issues.md).

## Cheat sheet 📇

| Problem | Answer |
|---|---|
| "My pages are `use client`, so no SSR" | `use client` still renders to HTML on the server — move the *fetch* to a server component |
| Server can't see the browser's session | Render the anonymous view on the server; upgrade in the browser for signed-in users |
| Keep private data out of a shared cache | The server only ever asks the API anonymously |
| Page awaits data → blank tab | Return a shell + `<Suspense>`; do the waiting in a child component inside it |
| Cache must be fresh-ish but cheap | `revalidate` for background refresh + `expire` as the hard limit |
| An error got cached as "not found" | Catch *outside* the `use cache` function — thrown errors aren't cached |
| Anonymous 404 turns into 401 | `@ResponseStatus` forwards to `/error` — permit it in Spring Security |
| MockMvc test passed, real server failed | MockMvc skips the error-page forward — test security with a real HTTP server |
| Public page fetches before the session is restored | Wait for the session check, or owners get "not found" on their own content |
| "5m ago" hydration error | `suppressHydrationWarning` on that one element |

## Key words

- **SSR (server-side rendering)** — building the page's HTML on the server, with
  the data in it, before sending it.
- **CSR (client-side rendering)** — sending a near-empty page and building the
  content in the browser with JavaScript.
- **Server component** — a React component that runs only on the server and ships
  no code to the browser; can `await` data directly.
- **Client component** — marked `"use client"`; rendered to HTML on the server
  *and* shipped to the browser to become interactive.
- **Hydration** — React attaching to server-rendered HTML in the browser,
  re-running the components and comparing the result.
- **Partial Prerendering (PPR)** — sending a static shell instantly and streaming
  the dynamic parts into it, split at `<Suspense>` boundaries.
- **Streaming** — one HTTP response written in pieces as they become ready.
- **Stale-while-revalidate** — serving the cached copy while a fresh one is built
  in the background.
- **Open Graph tags** — `<meta property="og:…">` tags that chat apps and social
  sites read to build a link preview.
