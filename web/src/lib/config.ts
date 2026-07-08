// Public config (safe to expose to the browser).
// Set these in web/.env.local for local dev (see .env.local.example).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090";

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
