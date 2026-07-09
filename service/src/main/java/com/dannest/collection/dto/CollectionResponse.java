package com.dannest.collection.dto;

import com.dannest.collection.Collection;
import com.dannest.collection.Visibility;
import com.dannest.media.Media;
import java.time.Instant;
import java.util.UUID;

/** API view of a collection. */
public record CollectionResponse(
        UUID id,
        UUID ownerId,
        String name,
        String description,
        Visibility visibility,
        UUID coverMediaId,
        String coverUrl,
        Instant createdAt,
        Instant updatedAt) {

    /** Map an entity to its response. Must run inside a transaction (touches lazy fields). */
    public static CollectionResponse from(Collection collection) {
        Media cover = collection.getCover();
        return new CollectionResponse(
                collection.getId(),
                collection.getOwner().getId(),
                collection.getName(),
                collection.getDescription(),
                collection.getVisibility(),
                cover != null ? cover.getId() : null,
                cover != null ? cover.getUrl() : null,
                collection.getCreatedAt(),
                collection.getUpdatedAt());
    }
}
