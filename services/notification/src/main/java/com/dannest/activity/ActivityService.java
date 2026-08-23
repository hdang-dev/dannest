package com.dannest.activity;

import com.dannest.activity.dto.ActivityResponse;
import com.dannest.common.PagedResponse;
import com.dannest.event.DannestEvent;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The caller's own activity feed — what *they* did, not what was done *to* them (that's
 * {@link com.dannest.notification.NotificationService}). {@link #recordFromEvent} is the
 * single write path, called from the RabbitMQ consumer bound to the {@code ACTIVITY_*}
 * routing keys — never directly by a controller.
 */
@Service
@Transactional
@RequiredArgsConstructor
public class ActivityService {

    private static final String TYPE_PREFIX = "ACTIVITY_";

    private final ActivityRepository activityRepository;

    @Transactional(readOnly = true)
    public PagedResponse<ActivityResponse> list(UUID actorId, Pageable pageable) {
        Pageable effective = pageable.getSort().isSorted()
                ? pageable
                : PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                        Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Activity> page = activityRepository.findByActorId(actorId, effective);
        return PagedResponse.of(page, ActivityService::toResponse);
    }

    /** Persist an activity row from a RabbitMQ event — strips the leading "ACTIVITY_" prefix. */
    public void recordFromEvent(DannestEvent event) {
        ActivityType type = ActivityType.valueOf(event.eventType().substring(TYPE_PREFIX.length()));
        Activity activity = Activity.builder()
                .actorId(event.actorId())
                .type(type)
                .collectionId(event.collectionId())
                .collectionName(event.collectionName())
                .postId(event.postId())
                .commentId(event.commentId())
                .build();
        activityRepository.save(activity);
    }

    // ----- mapping -------------------------------------------------------------------

    private static ActivityResponse toResponse(Activity a) {
        return new ActivityResponse(a.getId(), a.getType(), message(a), targetUrl(a), a.getCreatedAt());
    }

    private static String message(Activity a) {
        return switch (a.getType()) {
            case POST_CREATED -> "You created a new post in \"" + a.getCollectionName() + "\"";
            case COMMENT_CREATED -> "You commented on a post";
            case POST_LIKED -> "You liked a post";
            case COLLECTION_FOLLOWED -> "You followed \"" + a.getCollectionName() + "\"";
        };
    }

    /** Same shape as {@code NotificationService.targetUrl} — no post for a follow. */
    private static String targetUrl(Activity a) {
        if (a.getPostId() == null) {
            return "/collections/" + a.getCollectionId();
        }
        String url = "/collections/" + a.getCollectionId() + "?post=" + a.getPostId();
        if (a.getCommentId() != null) {
            url += "&comment=" + a.getCommentId();
        }
        return url;
    }
}
