// Client for the collections API (/api/v1/collections).
// Mirrors the backend DTOs in service/.../collection/dto.

import { apiFetch } from "./api";
import type { Crop } from "./media";

export type Visibility = "PUBLIC" | "PRIVATE";

/** Whose collections to list: your own (MINE) or every user's public ones (PUBLIC). */
export type CollectionScope = "MINE" | "PUBLIC";

export type Collection = {
  id: string;
  ownerId: string;
  ownerUsername: string;
  // The owner's own uploaded/embedded avatar — never the Google OAuth picture.
  ownerAvatarUrl: string | null;
  ownerAvatarCrop: Crop | null;
  name: string;
  description: string | null;
  visibility: Visibility;
  coverMediaId: string | null;
  coverUrl: string | null;
  coverCrop: Crop | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Page<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

export type CreateCollectionInput = {
  name: string;
  description?: string;
  visibility?: Visibility;
  coverMediaId?: string; // a media asset (uploaded or external)
};

export type UpdateCollectionInput = Partial<CreateCollectionInput> & {
  clearCover?: boolean; // remove the cover
};

/**
 * GET /api/v1/collections — list collections (non-archived).
 * - scope: MINE (default, your own) or PUBLIC (every user's public / home feed)
 * - visibility: PUBLIC/PRIVATE filter (applies to scope=MINE only)
 * - q: case-insensitive name search
 */
export function listCollections(
  params: {
    scope?: CollectionScope;
    visibility?: Visibility;
    archived?: boolean;
    q?: string;
    page?: number;
    size?: number;
  } = {},
) {
  const query = new URLSearchParams();
  if (params.scope) query.set("scope", params.scope);
  if (params.visibility) query.set("visibility", params.visibility);
  if (params.archived) query.set("archived", "true");
  if (params.q) query.set("q", params.q);
  if (params.page != null) query.set("page", String(params.page));
  if (params.size != null) query.set("size", String(params.size));
  const suffix = query.toString() ? `?${query}` : "";
  return apiFetch<Page<Collection>>(`/api/v1/collections${suffix}`);
}

/** GET /api/v1/collections/{id}. */
export function getCollection(id: string) {
  return apiFetch<Collection>(`/api/v1/collections/${id}`);
}

/** POST /api/v1/collections. */
export function createCollection(input: CreateCollectionInput) {
  return apiFetch<Collection>(`/api/v1/collections`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** PATCH /api/v1/collections/{id} — partial update. */
export function updateCollection(id: string, input: UpdateCollectionInput) {
  return apiFetch<Collection>(`/api/v1/collections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** DELETE /api/v1/collections/{id} — archives (soft-deletes) the collection. */
export function archiveCollection(id: string) {
  return apiFetch<void>(`/api/v1/collections/${id}`, { method: "DELETE" });
}

/** POST /api/v1/collections/{id}/unarchive — restores an archived collection. */
export function unarchiveCollection(id: string) {
  return apiFetch<Collection>(`/api/v1/collections/${id}/unarchive`, { method: "POST" });
}
