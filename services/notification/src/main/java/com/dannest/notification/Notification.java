package com.dannest.notification;

import com.dannest.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;

/**
 * An event the recipient should be told about. Denormalized on write from the {@code
 * DannestEvent} that created it — no foreign keys, no joins back to Core's database.
 */
@Entity
@Table(name = "notifications")
@Getter
public class Notification extends BaseEntity {

    @Column(name = "recipient_id", nullable = false)
    private UUID recipientId;

    @Column(name = "actor_id", nullable = false)
    private UUID actorId;

    @Column(name = "actor_username", nullable = false, length = 50)
    private String actorUsername;

    @Column(name = "actor_avatar_url")
    private String actorAvatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NotificationType type;

    @Column(name = "collection_id", nullable = false)
    private UUID collectionId;

    @Column(name = "collection_name", nullable = false, length = 100)
    private String collectionName;

    @Column(name = "post_id", nullable = false)
    private UUID postId;

    @Column(name = "comment_id")
    private UUID commentId;

    @Column(name = "read_at")
    private Instant readAt;

    protected Notification() {
    }

    public Notification(
            UUID recipientId,
            UUID actorId,
            String actorUsername,
            String actorAvatarUrl,
            NotificationType type,
            UUID collectionId,
            String collectionName,
            UUID postId,
            UUID commentId) {
        this.recipientId = recipientId;
        this.actorId = actorId;
        this.actorUsername = actorUsername;
        this.actorAvatarUrl = actorAvatarUrl;
        this.type = type;
        this.collectionId = collectionId;
        this.collectionName = collectionName;
        this.postId = postId;
        this.commentId = commentId;
    }

    public boolean isRead() {
        return readAt != null;
    }

    /** Mark read (idempotent). */
    public void markRead() {
        if (readAt == null) {
            readAt = Instant.now();
        }
    }
}
