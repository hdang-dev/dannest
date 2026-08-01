// Client for the notification service's API (/api/v1/notifications). This is a
// separate deployable from the rest of the backend — see services/notification/ —
// so every call here is pinned to NOTIFICATION_API_URL instead of the shared API_URL.
// message/targetUrl are resolved server-side per notification type — the UI just
// renders actorUsername + message and links to targetUrl.

import { apiFetch } from "./api";
import { NOTIFICATION_API_URL } from "./config";
import type { Page } from "./collections";

export type NotificationType = "NEW_POST" | "COMMENT_REPLY";

export type Notification = {
  id: string;
  actorId: string;
  actorUsername: string;
  actorAvatarUrl: string | null;
  type: NotificationType;
  message: string;
  targetUrl: string;
  read: boolean;
  createdAt: string;
};

function notificationFetch<T>(path: string, init: RequestInit = {}) {
  return apiFetch<T>(path, init, NOTIFICATION_API_URL);
}

/** GET /api/v1/notifications. */
export function listNotifications(params: { page?: number; size?: number } = {}) {
  const query = new URLSearchParams();
  if (params.page != null) query.set("page", String(params.page));
  if (params.size != null) query.set("size", String(params.size));
  const suffix = query.toString() ? `?${query}` : "";
  return notificationFetch<Page<Notification>>(`/api/v1/notifications${suffix}`);
}

/** GET /api/v1/notifications/unread-count. */
export function getUnreadNotificationCount() {
  return notificationFetch<{ count: number }>(`/api/v1/notifications/unread-count`);
}

/** POST /api/v1/notifications/{id}/read. */
export function markNotificationRead(id: string) {
  return notificationFetch<void>(`/api/v1/notifications/${id}/read`, { method: "POST" });
}

/** POST /api/v1/notifications/read-all. */
export function markAllNotificationsRead() {
  return notificationFetch<void>(`/api/v1/notifications/read-all`, { method: "POST" });
}
