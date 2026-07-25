// Client for the follow API (/api/v1/collections/{id}/follow, /api/v1/me/subscriptions).

import { apiFetch } from "./api";
import type { Collection, Page } from "./collections";

/** GET /api/v1/collections/{id}/follow — whether the caller follows this collection. */
export function getFollowStatus(collectionId: string) {
  return apiFetch<{ following: boolean }>(`/api/v1/collections/${collectionId}/follow`);
}

/** POST /api/v1/collections/{id}/follow. */
export function followCollection(collectionId: string) {
  return apiFetch<void>(`/api/v1/collections/${collectionId}/follow`, { method: "POST" });
}

/** DELETE /api/v1/collections/{id}/follow. */
export function unfollowCollection(collectionId: string) {
  return apiFetch<void>(`/api/v1/collections/${collectionId}/follow`, { method: "DELETE" });
}

/** GET /api/v1/me/subscriptions — collections the caller follows. */
export function listSubscriptions(params: { page?: number; size?: number } = {}) {
  const query = new URLSearchParams();
  if (params.page != null) query.set("page", String(params.page));
  if (params.size != null) query.set("size", String(params.size));
  const suffix = query.toString() ? `?${query}` : "";
  return apiFetch<Page<Collection>>(`/api/v1/me/subscriptions${suffix}`);
}
