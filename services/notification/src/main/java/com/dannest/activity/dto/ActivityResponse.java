package com.dannest.activity.dto;

import com.dannest.activity.ActivityType;
import java.time.Instant;
import java.util.UUID;

/**
 * API view of one activity row. {@code message}/{@code targetUrl} are resolved server-side
 * from {@code type} — same shape as {@code NotificationResponse}, minus actor fields, since
 * every row is always the caller's own action.
 */
public record ActivityResponse(UUID id, ActivityType type, String message, String targetUrl, Instant createdAt) {
}
