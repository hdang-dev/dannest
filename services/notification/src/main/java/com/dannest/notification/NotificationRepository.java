package com.dannest.notification;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByRecipientId(UUID recipientId, Pageable pageable);

    long countByRecipientIdAndReadAtIsNull(UUID recipientId);

    /** Bulk mark-all-read in one statement, rather than loading and saving every row. */
    @Modifying
    @Query("update Notification n set n.readAt = current_timestamp"
            + " where n.recipientId = :recipientId and n.readAt is null")
    void markAllRead(@Param("recipientId") UUID recipientId);
}
