// Central API client. Every authenticated request goes through apiFetch, which
// attaches the bearer token and — crucially — reacts to a 401 in ONE place: it
// ends the session so an expired/invalid token can never leave the app stuck
// silently failing every call.

import { API_URL } from "./config";
import { getToken } from "./token";

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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isFormData = init.body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      // Let the browser set the multipart boundary for FormData; otherwise JSON.
      ...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401) {
    // Token missing / expired / signed by another backend → end the session.
    onUnauthorized?.();
    throw new ApiError(401, "Session expired — please sign in again");
  }
  if (!res.ok) {
    throw new ApiError(res.status, `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T; // No Content (e.g. DELETE).
  return (await res.json()) as T;
}
