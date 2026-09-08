package com.dannest.notification;

/**
 * What the caller themselves did — as opposed to {@link NotificationType}, which is about
 * telling someone else something happened. Published unconditionally (no "never notify
 * yourself" check — the whole point is "I did this"), and deliberately fires for actions
 * {@link NotificationType} never publishes at all: a top-level comment (only replies
 * notify), or liking your own post (self-notify is suppressed, the like itself isn't).
 *
 * <p>Routing keys are namespaced {@code core.activity.*} — distinct from
 * {@code core.notification.*} even for the same underlying action. Adding a post notifies
 * the collection owner <em>and</em> lands in the actor's own activity feed: two events,
 * two keys, two queues.
 */
public enum ActivityType {
    POST_CREATED("core.activity.post-created"),
    COMMENT_CREATED("core.activity.comment-created"),
    POST_LIKED("core.activity.post-liked"),
    COLLECTION_FOLLOWED("core.activity.collection-followed");

    /** The routing key this type travels under on the {@code dannest.events} exchange. */
    public final String routingKey;

    ActivityType(String routingKey) {
        this.routingKey = routingKey;
    }

    public static ActivityType fromRoutingKey(String key) {
        for (ActivityType t : values()) {
            if (t.routingKey.equals(key)) {
                return t;
            }
        }
        throw new IllegalArgumentException("Unknown activity routing key: " + key);
    }
}
