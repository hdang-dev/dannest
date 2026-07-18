// Client for the comments API (/api/v1/posts/{id}/comments, /api/v1/comments/{id}).
// Mirrors the backend CommentResponse DTO. Comments are returned flat (top-level and
// replies together, oldest-first) — the UI groups replies under their parent.

import { apiFetch } from "./api";
import type { Page } from "./collections";
import type { Crop } from "./media";

export type Comment = {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  // The author's own uploaded/embedded avatar — never the Google OAuth picture.
  authorAvatarUrl: string | null;
  authorAvatarCrop: Crop | null;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateCommentInput = {
  content: string;
  parentCommentId?: string;
};

/** GET /api/v1/posts/{id}/comments. */
export function listComments(postId: string, params: { page?: number; size?: number } = {}) {
  const query = new URLSearchParams();
  if (params.page != null) query.set("page", String(params.page));
  if (params.size != null) query.set("size", String(params.size));
  const suffix = query.toString() ? `?${query}` : "";
  return apiFetch<Page<Comment>>(`/api/v1/posts/${postId}/comments${suffix}`);
}

/** POST /api/v1/posts/{id}/comments. */
export function createComment(postId: string, input: CreateCommentInput) {
  return apiFetch<Comment>(`/api/v1/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** PATCH /api/v1/comments/{id}. */
export function updateComment(id: string, content: string) {
  return apiFetch<Comment>(`/api/v1/comments/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}

/** DELETE /api/v1/comments/{id}. */
export function deleteComment(id: string) {
  return apiFetch<void>(`/api/v1/comments/${id}`, { method: "DELETE" });
}
