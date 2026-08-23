package com.dannest.activity;

import com.dannest.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A record of something the caller themselves did — posted, liked, commented, followed.
 * Distinct from {@link com.dannest.notification.Notification} (things others did *to* you):
 * this is actor-centric, fed by a separate RabbitMQ queue bound only to {@code ACTIVITY_*}
 * routing keys (see config/RabbitConfig). No actor username/avatar denormalized here — every
 * row belongs to exactly the user who did the thing, so there's nothing to look up.
 */
@Entity
@Table(name = "activities")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Activity extends BaseEntity {

    @Column(name = "actor_id", nullable = false)
    private UUID actorId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ActivityType type;

    @Column(name = "collection_id", nullable = false)
    private UUID collectionId;

    @Column(name = "collection_name", nullable = false, length = 100)
    private String collectionName;

    /** Null for activity types with no post, e.g. {@link ActivityType#COLLECTION_FOLLOWED}. */
    @Column(name = "post_id")
    private UUID postId;

    @Column(name = "comment_id")
    private UUID commentId;
}
