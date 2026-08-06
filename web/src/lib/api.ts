// Central API client. Every authenticated request goes through apiFetch, which
// attaches the bearer token and — crucially — reacts to a 401 in ONE place: first
// it tries a silent refresh (the refresh token lives in an httpOnly cookie, sent
// automatically via credentials: "include"); only if that also fails does it end
// the session, so a plain access-token expiry never kicks the user out.

import { API_URL } from "./config";
import { getToken, setToken } from "./token";

/** Thrown when the API responds with a non-2xx status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// The auth context registers a handler here (clear token + redirect to login).
// Keeping it as a callback avoids the API layer importing React/router directly.
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

// Lets other transports (e.g. the notification WebSocket, which can't go through
// apiFetch) end the session the same way an HTTP 401 does, instead of each
// reacting to an expired/invalid token in its own inconsistent way.
export function triggerUnauthorized(): void {
  onUnauthorized?.();
}

// If several requests 401 at once (e.g. a batch of calls on page load), only one
// should trigger POST /auth/refresh — the rest wait on this same in-flight call.
let refreshPromise: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ accessToken: string }>) : null))
      .then((data) => {
        if (!data) return null;
        setToken(data.accessToken);
        return data.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function doFetch(path: string, init: RequestInit, baseUrl: string, token: string | null): Promise<Response> {
  const isFormData = init.body instanceof FormData;
  return fetch(`${baseUrl}${path}`, {
    ...init,
    // Only /auth/refresh and /auth/logout actually read a cookie (it's scoped to
    // /api/v1/auth), so this is a no-op for every other request.
    credentials: "include",
    headers: {
      // Let the browser set the multipart boundary for FormData; otherwise JSON.
      ...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  baseUrl: string = API_URL,
): Promise<T> {
  let res = await doFetch(path, init, baseUrl, getToken());

  if (res.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      res = await doFetch(path, init, baseUrl, refreshedToken);
    }
  }

  if (res.status === 401) {
    // Refresh token missing/expired too — the session is really over.
    onUnauthorized?.();
    throw new ApiError(401, "Session expired — please sign in again");
  }
  if (!res.ok) {
    throw new ApiError(res.status, `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T; // No Content (e.g. DELETE).
  return (await res.json()) as T;
}
