package com.dannest.common;

import java.util.UUID;

/**
 * Projection for a grouped count keyed by an entity id — e.g. likes-per-post or
 * comments-per-post, fetched in one query instead of one per row.
 */
public interface AggregateCount {

    UUID getId();

    long getCount();
}
