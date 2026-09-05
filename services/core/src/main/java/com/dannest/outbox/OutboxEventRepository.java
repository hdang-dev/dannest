package com.dannest.outbox;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {

    /**
     * The poller's only query: oldest unpublished rows first. No {@code FOR UPDATE SKIP
     * LOCKED} claim dance — this service runs single-instance (same constraint
     * Notification does), so there's never a second poller to race with.
     */
    List<OutboxEvent> findByPublishedAtIsNullOrderByCreatedAt(Pageable pageable);
}
