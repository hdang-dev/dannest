// The access token is kept in memory only (never localStorage/sessionStorage), so
// it's unreachable by an XSS payload reading browser storage. The tradeoff: it's
// gone on every page reload — that's expected, and is why the auth context calls
// POST /auth/refresh on load to silently get a new one from the refresh cookie.
// This module is the single place that reads/writes it, so both the auth context
// and the API layer share one source of truth.

let accessToken: string | null = null;

export function getToken(): string | null {
  return accessToken;
}

export function setToken(token: string): void {
  accessToken = token;
}

export function clearToken(): void {
  accessToken = null;
}
