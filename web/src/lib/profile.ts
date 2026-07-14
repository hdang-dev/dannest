// Client for the user profile API (/api/v1/users).
// Mirrors the backend DTOs in service/.../user/dto.

import { apiFetch } from "./api";
import type { Crop } from "./media";

export type Profile = {
  id: string;
  username: string;
  // Only populated when viewing your own profile — omitted for other users.
  email: string | null;
  bio: string | null;
  avatarMediaId: string | null;
  // The user's own uploaded/embedded avatar only — never the OAuth provider photo.
  avatarUrl: string | null;
  avatarCrop: Crop | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateProfileInput = {
  username?: string;
  bio?: string;
  avatarMediaId?: string; // a media asset (uploaded or external) the caller owns
  clearAvatar?: boolean; // remove the avatar
};

/** GET /api/v1/users/{id}. */
export function getProfile(id: string) {
  return apiFetch<Profile>(`/api/v1/users/${id}`);
}

/** PATCH /api/v1/users/me — partial update of the caller's own profile. */
export function updateMyProfile(input: UpdateProfileInput) {
  return apiFetch<Profile>(`/api/v1/users/me`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
