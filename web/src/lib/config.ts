// Public config (safe to expose to the browser).
// Set these in web/.env.local for local dev (see .env.local.example).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090";

// The notification service is a separate deployable with its own origin — see
// services/notification/. Everything else still goes through API_URL.
export const NOTIFICATION_API_URL =
  process.env.NEXT_PUBLIC_NOTIFICATION_API_URL ?? "http://localhost:8091";

// The media service is a separate deployable with its own origin — see
// services/media/. Uploads/crop-updates/deletes go straight there; Core only
// ever holds a denormalized url/crop snapshot (see docs/tech/architecture-flows.md).
export const MEDIA_API_URL =
  process.env.NEXT_PUBLIC_MEDIA_API_URL ?? "http://localhost:8092";

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
