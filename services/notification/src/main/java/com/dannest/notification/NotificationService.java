package com.dannest.notification;

import com.dannest.common.ForbiddenException;
import com.dannest.common.PagedResponse;
import com.dannest.common.ResourceNotFoundException;
import com.dannest.event.DannestEvent;
import com.dannest.notification.dto.NotificationResponse;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A user's notification feed: list (paged, newest-first), unread count, and mark read
 * (single or all). {@link #recordFromEvent} is the single write path — called from the
 * RabbitMQ consumer, never directly by a controller — and also pushes the new row over
 * WebSocket to whichever client is live-connected for that recipient.
 */
@Service
@Transactional
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public NotificationService(
            NotificationRepository notificationRepository, SimpMessagingTemplate messagingTemplate) {
        this.notificationRepository = notificationRepository;
        this.messagingTemplate = messagingTemplate;
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
        return notificationRepository.countByRecipientIdAndReadAtIsNull(userId);
    }

    /** Mark one notification read; idempotent. */
    public void markRead(UUID userId, UUID notificationId) {
        Notification notification = notificationRepository
                .findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + notificationId));
        if (!notification.getRecipientId().equals(userId)) {
            throw new ForbiddenException("You do not own this notification");
        }
        notification.markRead();
    }

    public void markAllRead(UUID userId) {
        notificationRepository.markAllRead(userId);
    }

    /** Persist a notification from a RabbitMQ event, then push it live to a connected client. */
    public void recordFromEvent(DannestEvent event) {
        Notification notification = new Notification(
                event.recipientId(),
                event.actorId(),
                event.actorUsername(),
                event.actorAvatarUrl(),
                NotificationType.valueOf(event.eventType()),
                event.collectionId(),
                event.collectionName(),
                event.postId(),
                event.commentId());
        notification = notificationRepository.save(notification);

        messagingTemplate.convertAndSend(
                "/topic/notifications/" + event.recipientId(), toResponse(notification));
    }

    // ----- mapping -------------------------------------------------------------------

    private static NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getActorId(),
                n.getActorUsername(),
                n.getActorAvatarUrl(),
                n.getType(),
                message(n),
                targetUrl(n),
                n.isRead(),
                n.getCreatedAt());
    }

    private static String message(Notification n) {
        return switch (n.getType()) {
            case NEW_POST -> "added a new post to \"" + n.getCollectionName() + "\"";
            case COMMENT_REPLY -> "replied to your comment";
        };
    }

    /** Deep-links to the post (and, for a reply, the specific comment) so the UI can focus it. */
    private static String targetUrl(Notification n) {
        String url = "/collections/" + n.getCollectionId() + "?post=" + n.getPostId();
        if (n.getCommentId() != null) {
            url += "&comment=" + n.getCommentId();
        }
        return url;
    }
}
