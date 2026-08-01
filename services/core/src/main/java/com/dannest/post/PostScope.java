package com.dannest.post;

/** Which posts a list request targets. */
public enum PostScope {
    /** Posts authored by the caller. */
    MINE,
    /** Posts in public, non-archived collections across all users (the home feed). */
    FEED,
}
