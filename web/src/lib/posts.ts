// Client for the posts API (/api/v1/posts). Mirrors the backend PostResponse DTO.
// A post belongs to a collection and inherits its visibility (posts have none of their own).

import { apiFetch } from "./api";
import type { Page } from "./collections";
import type { Crop } from "./media";

export type PostVisibility = "PUBLIC" | "PRIVATE";

/** One image on a post — a media asset (uploaded or external) with a display crop. */
export type PostImage = {
  mediaId: string;
  url: string;
  crop: Crop;
  displayOrder: number;
};

export type Post = {
  id: string;
  collectionId: string;
  collectionName: string;
  collectionVisibility: PostVisibility;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  title: string;
  content: string | null;
  images: PostImage[];
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreatePostInput = {
  collectionId: string;
  title: string;
  content?: string;
  mediaIds?: string[]; // images in display order (each owned by the caller)
};

export type UpdatePostInput = Partial<CreatePostInput>;

type ListParams = { q?: string; page?: number; size?: number };

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** GET /api/v1/posts?scope=FEED — public posts across all users (the home feed). */
export function listFeed(params: ListParams = {}) {
  return apiFetch<Page<Post>>(
    `/api/v1/posts${query({ scope: "FEED", q: params.q, page: params.page, size: params.size })}`,
  );
}

/** GET /api/v1/collections/{id}/posts — every post in one collection. */
export function listByCollection(collectionId: string, params: ListParams = {}) {
  return apiFetch<Page<Post>>(`/api/v1/collections/${collectionId}/posts${query({ ...params })}`);
}

/** GET /api/v1/posts/{id}. */
export function getPost(id: string) {
  return apiFetch<Post>(`/api/v1/posts/${id}`);
}

/** POST /api/v1/posts. */
export function createPost(input: CreatePostInput) {
  return apiFetch<Post>(`/api/v1/posts`, { method: "POST", body: JSON.stringify(input) });
}

/** PATCH /api/v1/posts/{id} — partial update. */
export function updatePost(id: string, input: UpdatePostInput) {
  return apiFetch<Post>(`/api/v1/posts/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

/** DELETE /api/v1/posts/{id}. (Shipped for completeness; not wired into the UI yet.) */
export function deletePost(id: string) {
  return apiFetch<void>(`/api/v1/posts/${id}`, { method: "DELETE" });
}

/** POST /api/v1/posts/{id}/likes — idempotent. */
export function likePost(id: string) {
  return apiFetch<void>(`/api/v1/posts/${id}/likes`, { method: "POST" });
}

/** DELETE /api/v1/posts/{id}/likes — idempotent. */
export function unlikePost(id: string) {
  return apiFetch<void>(`/api/v1/posts/${id}/likes`, { method: "DELETE" });
}
