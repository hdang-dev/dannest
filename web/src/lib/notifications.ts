// Client for the notifications API (/api/v1/notifications).
// message/targetUrl are resolved server-side per notification type — the UI just
// renders actorUsername + message and links to targetUrl.

import { apiFetch } from "./api";
import type { Page } from "./collections";
import type { Crop } from "./media";

export type NotificationType = "NEW_POST" | "COMMENT_REPLY";

export type Notification = {
  id: string;
  actorId: string;
  actorUsername: string;
  actorAvatarUrl: string | null;
  actorAvatarCrop: Crop | null;
  type: NotificationType;
  message: string;
  targetUrl: string;
  read: boolean;
  createdAt: string;
};

/** GET /api/v1/notifications. */
export function listNotifications(params: { page?: number; size?: number } = {}) {
  const query = new URLSearchParams();
  if (params.page != null) query.set("page", String(params.page));
  if (params.size != null) query.set("size", String(params.size));
  const suffix = query.toString() ? `?${query}` : "";
  return apiFetch<Page<Notification>>(`/api/v1/notifications${suffix}`);
}

/** GET /api/v1/notifications/unread-count. */
export function getUnreadNotificationCount() {
  return apiFetch<{ count: number }>(`/api/v1/notifications/unread-count`);
}

/** POST /api/v1/notifications/{id}/read. */
export function markNotificationRead(id: string) {
  return apiFetch<void>(`/api/v1/notifications/${id}/read`, { method: "POST" });
}

/** POST /api/v1/notifications/read-all. */
export function markAllNotificationsRead() {
  return apiFetch<void>(`/api/v1/notifications/read-all`, { method: "POST" });
}
