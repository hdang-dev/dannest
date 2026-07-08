# Lesson 3 — Login with Google (from zero)

This is the "how does a user prove who they are" lesson.

## 1. The two words

- **Authentication (authN)** → *who are you?* (logging in)
- **Authorization (authZ)** → *what are you allowed to do?* (permissions)

This lesson is about **authentication**: proving you are you.

## 2. Why "Sign in with Google" (not passwords)

Passwords are a pain **and** a risk: you'd have to store them safely, handle
"forgot password," reset emails, hashing, leaks… For a learning project we skip
all of that and let **Google** vouch for the user.

```
Old way:  user → gives US a password → WE must keep it safe 😰
Our way:  user → logs into GOOGLE → Google tells us "yep, it's them" 😌
```

We never see a password. Google does the hard part.

## 3. The key idea: TWO different tokens 🎟️

This trips everyone up at first. There are **two** tokens, and they are not the
same:

| Token | Made by | Says | Lives how long |
| --- | --- | --- | --- |
| **Google ID token** | Google | "this is haidang@gmail.com" | ~1 hour, used **once** at login |
| **Our JWT** | Our backend | "this is DanNest user #abc" | 7 days, sent on **every** request |

Think of it like a passport vs a wristband:

```
Google ID token = your PASSPORT   → you show it ONCE at the door
Our JWT         = the WRISTBAND   → the door gives it to you; you flash it
                                     everywhere inside, no passport needed again
```

Why not just keep using Google's token? Because it's Google's, it expires fast,
and *our* app should decide who its own users are. So we trade the passport for
our own wristband.

## 4. The whole flow 🔁

```
1. User clicks "Sign in with Google"        (web)
        │
2. Google popup → user picks account
        │  Google hands back an ID TOKEN
        ▼
3. Web sends that ID token to OUR backend    POST /api/v1/auth/google
        │
4. Backend asks Google's library: "is this token real & for MY app?"  ✅
        │
5. Backend finds the user by Google id...
        ├─ exists?    → use it
        └─ new?       → CREATE a User row   (find-or-create)
        │
6. Backend mints OUR OWN JWT and returns it
        │
7. Web stores the JWT (localStorage) and shows the user as logged in
        │
8. Every later request:  Authorization: Bearer <our-jwt>
        ▼
   Backend checks the wristband — no Google needed again
```

## 5. The pieces (and what each is)

| Piece | What it is | Where |
| --- | --- | --- |
| **Client ID** | public name of our app to Google | `web/.env.local`, backend env |
| **Google verifier** | checks the ID token is real | `service/.../auth/GoogleTokenVerifier.java` |
| **JwtService** | mints & signs OUR JWT | `service/.../auth/JwtService.java` |
| **AuthService** | verify → find-or-create user → mint JWT | `service/.../auth/AuthService.java` |
| **AuthController** | the `/auth/google` + `/auth/me` endpoints | `service/.../auth/AuthController.java` |
| **SecurityConfig** | who can hit what; validates JWTs | `service/.../config/SecurityConfig.java` |
| **AuthProvider** | React context holding the logged-in user | `web/src/lib/auth.tsx` |
| **GoogleSignIn** | the Google button | `web/src/components/GoogleSignIn.tsx` |

## 6. "Stateless" — the backend has no memory 🧠❌

Our backend keeps **no login sessions** in memory or a database. Everything
needed is *inside* the JWT, and the JWT is **signed** so it can't be faked.

```
Request comes in with a JWT
   → backend checks the signature with its secret key
   → signature valid?  ✅ trust the claims (user id, email) inside
   → invalid/expired?  ❌ 401 Unauthorized
```

No server-side session store. This is why it's called a **stateless** API —
easy to scale, nothing to "remember."

## 7. Client ID vs Client Secret vs JS origins

Three Google words that confused us during setup:

- **Client ID** — *public*. Safe to ship in the frontend. Identifies our app.
- **Client Secret** — we **don't use it** (our button flow doesn't need it).
  Never put it in the frontend.
- **Authorized JavaScript origins** — the list of websites Google will accept
  the button on. **`http://localhost:3000`** for local dev,
  `https://dannest-punh.onrender.com` for prod.

> The "no registered origin / invalid_client" error = the site you're on isn't
> in that JavaScript-origins list. It's a **config** problem, never a code one.
> (And it's *origins* — no `/callback` path; that field stays empty for us.)

## 8. Security notes 🔒

- **`email_verified` required** — we only accept Google accounts whose email
  Google has verified.
- **Audience check** — the verifier makes sure the token was minted **for our
  Client ID**, not some other app's.
- **JWT secret** — the key that signs our wristbands. Lives in an env var
  (`JWT_SECRET`), never in Git. A strong random value in prod.
- **`password_hash` is now optional** — Google users have no password; the
  column is nullable and we store `provider = GOOGLE` + `provider_id` instead.

## 9. Login page & route guard (frontend)

- `/login` — a plain page with just the Google button. When you're logged in it
  bounces you to `/`.
- `RequireAuth` — wraps the home page; if you're **not** logged in it sends you
  to `/login`. Logging out clears the wristband → the guard kicks you back to
  `/login`.

```
not logged in → visit /      → guard → /login
logged in     → visit /login → redirect → /
logout                       → guard → /login
```

## 10. What you achieved ✅

- Real **"Sign in with Google"** — no passwords to store.
- Understood the **two-token** dance (Google ID token → our JWT).
- A **stateless**, JWT-protected backend.
- **Find-or-create**: first login makes the user row automatically.
- A proper **login page + route guard** on the frontend.

## Cheat sheet 📇

| What | Where |
| --- | --- |
| Start login (get Google token) | `GoogleSignIn.tsx` |
| Exchange for our JWT | `POST /api/v1/auth/google` |
| Who am I? | `GET /api/v1/auth/me` (send `Authorization: Bearer <jwt>`) |
| Store the JWT | `localStorage` key `dannest_token` |
| Add a login provider later | new verifier + branch in `AuthService` |
| Fix "no registered origin" | add the site to **Authorized JavaScript origins** |

## Key words

- **Authentication** — proving who you are (login).
- **OAuth / OpenID Connect** — the standard behind "Sign in with Google."
- **ID token** — Google's short-lived "this is who they are" token.
- **JWT (JSON Web Token)** — a signed token our app issues and trusts.
- **Claims** — the facts inside a JWT (user id, email, expiry).
- **Stateless** — the server keeps no session; the token carries everything.
- **Find-or-create** — reuse the user if known, else make one on first login.
- **Client ID / Secret** — app's public name / private key with Google.
- **JavaScript origin** — a website Google allows the button on.
