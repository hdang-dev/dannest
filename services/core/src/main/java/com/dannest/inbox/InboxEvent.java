package com.dannest.inbox;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * "Have we already processed this event" — one row per (event, consumer). See
 * {@link Idempotency#tryClaim} for the actual insert-or-skip usage; this entity only
 * exists to give that a JPA-mapped table to insert into.
 */
@Entity
@Table(name = "inbox_event")
@IdClass(InboxEventId.class)
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class InboxEvent {

    @Id
    @Column(name = "event_id")
    private UUID eventId;

    @Id
    @Column(name = "consumer")
    private String consumer;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;
}
