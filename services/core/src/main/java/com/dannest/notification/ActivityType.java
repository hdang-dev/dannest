package com.dannest.notification;

/**
 * What the caller themselves did — as opposed to {@link NotificationType}, which is about
 * telling someone else something happened. Published unconditionally (no "never notify
 * yourself" check — the whole point is "I did this"), and deliberately fires for actions
 * {@link NotificationType} never publishes at all: a top-level comment (only replies
 * notify), or liking your own post (self-notify is suppressed, the like itself isn't).
 *
 * <p>Event type strings are prefixed {@code ACTIVITY_} (see {@link NotificationService#publishActivity})
 * so they never collide with a {@link NotificationType} value on the shared
 * {@code dannest.events} exchange — the notification service's queue binds only to the four
 * {@link NotificationType} routing keys, so an {@code ACTIVITY_*} message never reaches it.
 */
public enum ActivityType {
    POST_CREATED,
    COMMENT_CREATED,
    POST_LIKED,
    COLLECTION_FOLLOWED,
}
