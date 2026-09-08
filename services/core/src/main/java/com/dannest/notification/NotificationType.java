package com.dannest.notification;

public enum NotificationType {
    NEW_POST("core.notification.post-created"),
    COMMENT_REPLY("core.notification.comment-replied"),
    FOLLOW("core.notification.collection-followed"),
    POST_LIKED("core.notification.post-liked");

    /** The routing key this type travels under on the {@code dannest.events} exchange. */
    public final String routingKey;

    NotificationType(String routingKey) {
        this.routingKey = routingKey;
    }

    public static NotificationType fromRoutingKey(String key) {
        for (NotificationType t : values()) {
            if (t.routingKey.equals(key)) {
                return t;
            }
        }
        throw new IllegalArgumentException("Unknown notification routing key: " + key);
    }
}
