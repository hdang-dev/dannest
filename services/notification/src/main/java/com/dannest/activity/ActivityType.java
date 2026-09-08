package com.dannest.activity;

/** Mirrors Core's {@code com.dannest.notification.ActivityType} by name and routing key. */
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
