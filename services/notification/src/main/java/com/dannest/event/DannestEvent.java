package com.dannest.event;

import java.time.Instant;
import java.util.UUID;

/**
 * Domain event published by Core to the {@code dannest.events} RabbitMQ exchange.
 *
 * <p>Carries denormalized display data (actor username/avatar, collection name) rather than
 * just ids — this service has its own database and must never query Core's to render a
 * notification. Mirrors the producer-side record in Core 1:1 by field name (JSON, not a
 * shared library — each service keeps its own copy on purpose).
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
