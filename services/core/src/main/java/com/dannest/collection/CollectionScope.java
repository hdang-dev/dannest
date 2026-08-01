package com.dannest.collection;

/** Which collections a list request targets. */
public enum CollectionScope {
    /** The caller's own collections. */
    MINE,
    /** Public collections across all users (the home feed). */
    PUBLIC,
}
