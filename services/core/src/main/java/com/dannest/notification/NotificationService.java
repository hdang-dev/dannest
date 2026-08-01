package com.dannest.notification;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.comment.CommentRepository;
import com.dannest.common.ForbiddenException;
import com.dannest.common.PagedResponse;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.event.DannestEvent;
import com.dannest.event.EventPublisher;
import com.dannest.media.Media;
import com.dannest.media.dto.CropDto;
import com.dannest.notification.dto.NotificationResponse;
import com.dannest.post.PostRepository;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A user's notification feed: list (paged, newest-first), unread count, and mark read
 * (single or all). {@link #notify} is the single write path every event goes through —
 * it also owns the "never notify yourself" rule, so callers don't each need to check it.
 */
@Service
@Transactional
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final CollectionRepository collectionRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final EventPublisher eventPublisher;

    public NotificationService(
            NotificationRepository notificationRepository,
            UserRepository userRepository,
            CollectionRepository collectionRepository,
            PostRepository postRepository,
            CommentRepository commentRepository,
            EventPublisher eventPublisher) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.collectionRepository = collectionRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public PagedResponse<NotificationResponse> list(UUID userId, Pageable pageable) {
        Pageable effective = pageable.getSort().isSorted()
                ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                        Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Notification> page = notificationRepository.findByRecipientId(userId, effective);
        return PagedResponse.of(page, NotificationService::toResponse);
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return notificationRepository.countByRecipient_IdAndReadAtIsNull(userId);
    }

    /** Mark one notification read; idempotent. */
    public void markRead(UUID userId, UUID notificationId) {
        Notification notification = notificationRepository
                .findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + notificationId));
        if (!notification.getRecipient().getId().equals(userId)) {
            throw new ForbiddenException("You do not own this notification");
        }
        notification.markRead();
    }

    public void markAllRead(UUID userId) {
        notificationRepository.markAllRead(userId);
    }

    /**
     * Record a notification event. No-op if the actor is the recipient.
     *
     * <p>Writes locally (unchanged) AND publishes a {@link DannestEvent} for the notification
     * service to pick up — both paths run side by side until that service is verified and the
     * frontend is cut over to it, at which point the local write goes away.
     */
    public void notify(
            UUID recipientId, UUID actorId, NotificationType type, UUID collectionId, UUID postId, UUID commentId) {
        if (recipientId.equals(actorId)) {
            return;
        }
        // Fetched (not getReferenceById) since the event payload below needs real field
        // values anyway — a lazy reference would just trigger the same query on first access.
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + actorId));
        Collection collection = collectionRepository.findById(collectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found: " + collectionId));

        Notification notification = new Notification(
                userRepository.getReferenceById(recipientId),
                actor,
                type,
                collection,
                postRepository.getReferenceById(postId),
                commentId != null ? commentRepository.getReferenceById(commentId) : null);
        notificationRepository.save(notification);

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

    // ----- mapping -------------------------------------------------------------------

    private static NotificationResponse toResponse(Notification n) {
        User actor = n.getActor();
        Media avatar = actor.getAvatar();
        return new NotificationResponse(
                n.getId(),
                actor.getId(),
                actor.getUsername(),
                avatar != null ? avatar.getUrl() : null,
                avatar != null ? CropDto.from(avatar.getCrop()) : null,
                n.getType(),
                message(n),
                targetUrl(n),
                n.isRead(),
                n.getCreatedAt());
    }

    private static String message(Notification n) {
        return switch (n.getType()) {
            case NEW_POST -> "added a new post to \"" + n.getCollection().getName() + "\"";
            case COMMENT_REPLY -> "replied to your comment";
        };
    }

    /** Deep-links to the post (and, for a reply, the specific comment) so the UI can focus it. */
    private static String targetUrl(Notification n) {
        String url = "/collections/" + n.getCollection().getId() + "?post=" + n.getPost().getId();
        if (n.getComment() != null) {
            url += "&comment=" + n.getComment().getId();
        }
        return url;
    }
}
