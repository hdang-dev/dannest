package com.dannest.outbox;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One row per domain event this service owes the world — written in the same
 * transaction as the business row it describes (see {@link OutboxWriter}), published
 * by {@link OutboxPoller}, never read by anything else. {@code payload} is
 * already-serialized JSON, sent to RabbitMQ verbatim.
 */
@Entity
@Table(name = "outbox_event")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "aggregate_type", nullable = false, length = 20)
    private String aggregateType;

    // String, not UUID — an aggregate this event describes might be identified in another
    // service's id format (e.g. a marketplace purchase id is a Mongo ObjectId).
    @Column(name = "aggregate_id", nullable = false, length = 64)
    private String aggregateId;

    /** Also the RabbitMQ routing key on {@code dannest.events}. */
    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(nullable = false, columnDefinition = "text")
    private String payload;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Builder.Default
    @Column(nullable = false)
    private int attempts = 0;

    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;
}
