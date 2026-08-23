// Client for the activity API (/api/v1/activity) — served by the notification service (see
// services/notification/src/main/java/com/dannest/activity/), same pattern as notifications.ts.
// This is "what I did" (posted, liked, commented, followed), not "what was done to me" —
// that's notifications.ts. message/targetUrl are resolved server-side; the UI just renders them.

import { apiFetch } from "./api";
import { NOTIFICATION_API_URL } from "./config";
import type { Page } from "./collections";

export type ActivityType = "POST_CREATED" | "COMMENT_CREATED" | "POST_LIKED" | "COLLECTION_FOLLOWED";

export type Activity = {
  id: string;
  type: ActivityType;
  message: string;
  targetUrl: string;
  createdAt: string;
};

/** GET /api/v1/activity. */
export function listActivity(params: { page?: number; size?: number } = {}) {
  const query = new URLSearchParams();
  if (params.page != null) query.set("page", String(params.page));
  if (params.size != null) query.set("size", String(params.size));
  const suffix = query.toString() ? `?${query}` : "";
  return apiFetch<Page<Activity>>(`/api/v1/activity${suffix}`, {}, NOTIFICATION_API_URL);
}
