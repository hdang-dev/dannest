package com.dannest.inbox;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InboxEventRepository extends JpaRepository<InboxEvent, InboxEventId> {

    /**
     * The insert-or-skip itself — {@code ON CONFLICT DO NOTHING} makes this safe to
     * call for a duplicate delivery. Returns the number of rows actually inserted:
     * 1 = first time seeing this event, 0 = already processed.
     */
    @Modifying
    @Query(
            value = "insert into inbox_event (event_id, consumer, received_at) "
                    + "values (:eventId, :consumer, now()) on conflict do nothing",
            nativeQuery = true)
    int tryInsert(@Param("eventId") UUID eventId, @Param("consumer") String consumer);
}
