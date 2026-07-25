package com.dannest.notification;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /** A user's notifications — actor (and their avatar), collection, and post joined in to avoid N+1. */
    @Query(value = "select n from Notification n"
            + " join fetch n.actor a left join fetch a.avatar"
            + " join fetch n.collection join fetch n.post"
            + " where n.recipient.id = :recipientId",
            countQuery = "select count(n) from Notification n where n.recipient.id = :recipientId")
    Page<Notification> findByRecipientId(@Param("recipientId") UUID recipientId, Pageable pageable);

    long countByRecipient_IdAndReadAtIsNull(UUID recipientId);

    /** Bulk mark-all-read in one statement, rather than loading and saving every row. */
    @Modifying
    @Query("update Notification n set n.readAt = current_timestamp"
            + " where n.recipient.id = :recipientId and n.readAt is null")
    void markAllRead(@Param("recipientId") UUID recipientId);
}
