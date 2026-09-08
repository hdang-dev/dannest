package com.dannest.notification;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.event.DannestEvent;
import com.dannest.event.EventPublisher;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Publishes a {@link DannestEvent} when something happens that the recipient should be told
 * about — new post in a followed collection, reply to a comment. Also owns the "never notify
 * yourself" rule, so callers don't each need to check it.
 *
 * <p>Core doesn't store or serve notifications itself — that's the notification service's
 * job (its own database, its own read API). This is a publish-only, fire-and-forget path.
 */
@Service
@Transactional
@RequiredArgsConstructor
public class NotificationService {

    private final UserRepository userRepository;
    private final CollectionRepository collectionRepository;
    private final EventPublisher eventPublisher;

    /** Publish a notification event. No-op if the actor is the recipient. */
    public void notify(
            UUID recipientId, UUID actorId, NotificationType type, UUID collectionId, UUID postId, UUID commentId) {
        if (recipientId.equals(actorId)) {
            return;
        }
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorId));
        Collection collection = collectionRepository.findById(collectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found: " + collectionId));

        eventPublisher.publish(new DannestEvent(
                type.name(),
                recipientId,
                actorId,
                actor.getUsername(),
                actor.getAvatarUrl(),
                collectionId,
                collection.getName(),
                postId,
                commentId,
                Instant.now()));
    }

    /**
     * Publish a record of something the caller themselves did — unconditional, no self-check
     * (unlike {@link #notify}, there's no "recipient" to suppress). {@code recipientId} is set
     * to {@code actorId} since the event has no other recipient concept; the activity log
     * consumer ignores it and keys everything off {@code actorId} instead.
     */
    public void publishActivity(UUID actorId, ActivityType type, UUID collectionId, UUID postId, UUID commentId) {
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorId));
        Collection collection = collectionRepository.findById(collectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found: " + collectionId));

        eventPublisher.publish(new DannestEvent(
                "ACTIVITY_" + type.name(),
                actorId,
                actorId,
                actor.getUsername(),
                actor.getAvatarUrl(),
                collectionId,
                collection.getName(),
                postId,
                commentId,
                Instant.now()));
    }
}
