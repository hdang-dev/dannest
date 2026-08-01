package com.dannest.notification.dto;

import com.dannest.notification.NotificationType;
import java.time.Instant;
import java.util.UUID;

/**
 * API view of a notification. {@code message} and {@code targetUrl} are resolved server-side
 * from {@code type} — the frontend just renders {@code actorUsername + message} and links to
 * {@code targetUrl}, with no per-type logic of its own.
 */
public record NotificationResponse(
        UUID id,
        UUID actorId,
        String actorUsername,
        String actorAvatarUrl,
        NotificationType type,
        String message,
        String targetUrl,
        boolean read,
        Instant createdAt) {
}
