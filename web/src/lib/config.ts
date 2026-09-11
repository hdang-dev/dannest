// Public config (safe to expose to the browser).
// Set these in web/.env.local for local dev (see .env.local.example).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090";

// The notification service is a separate deployable with its own origin — see
// services/notification/. Everything else still goes through API_URL.
export const NOTIFICATION_API_URL =
  process.env.NEXT_PUBLIC_NOTIFICATION_API_URL ?? "http://localhost:8091";

// The marketplace service is a separate deployable with its own origin — see
// services/marketplace/. Membership purchases and Stripe Connect onboarding go
// straight there.
export const MARKETPLACE_API_URL =
  process.env.NEXT_PUBLIC_MARKETPLACE_API_URL ?? "http://localhost:8092";

// Render's free tier spins each service down after 15 idle minutes and takes
// ~30s to wake one on the next request. Core gets warmed implicitly by
// AuthProvider's refresh call on every load, but marketplace and notification
// otherwise only wake when a user happens to hit a feature that needs them —
// see lib/warmup.ts and instrumentation.ts, which ping all three in parallel
// as early as possible instead of waking them one at a time, on demand.
export const HEALTH_ENDPOINTS: { name: string; url: string }[] = [
  { name: "core", url: `${API_URL}/actuator/health` },
  { name: "marketplace", url: `${MARKETPLACE_API_URL}/healthz` },
  { name: "notification", url: `${NOTIFICATION_API_URL}/actuator/health` },
];

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// Publishable, not secret — safe to ship in client JS by design, set as a GitHub
// Actions *variable* (not a secret) so `${{ vars.* }}` in the deploy workflow can
// read it. Used by Stripe Elements to render the card form (see MembershipCheckoutModal).
export const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
