package com.dannest.event;

import java.time.Instant;
import java.util.UUID;

/**
 * Domain event published to the {@code dannest.events} RabbitMQ exchange for other services
 * to consume independently — today, just the notification service.
 *
 * <p>Carries denormalized display data (actor username/avatar, collection name) rather than
 * just ids, since a consumer may have its own database and must never query this one to
 * render something. Mirrors the consumer-side record 1:1 by field name (JSON, not a shared
 * library — each service keeps its own copy on purpose).
 */
public record DannestEvent(
        String eventType,
        UUID recipientId,
        UUID actorId,
        String actorUsername,
        String actorAvatarUrl,
        UUID collectionId,
        String collectionName,
        UUID postId,
        UUID commentId,
        Instant occurredAt) {
}
