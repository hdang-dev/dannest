package com.dannest.collection.dto;

import com.dannest.collection.Collection;
import com.dannest.collection.Visibility;
import com.dannest.common.CropDto;
import com.dannest.user.User;
import java.time.Instant;
import java.util.UUID;

/**
 * API view of a collection.
 *
 * <p>{@code ownerAvatarUrl}/{@code ownerAvatarCrop} are sourced only from the owner's own
 * denormalized avatar snapshot — never the legacy OAuth avatar string.
 */
public record CollectionResponse(
        UUID id,
        UUID ownerId,
        String ownerUsername,
        String ownerAvatarUrl,
        CropDto ownerAvatarCrop,
        String name,
        String description,
        Visibility visibility,
        String coverMediaId,
        String coverUrl,
        CropDto coverCrop,
        Instant archivedAt,
        Instant createdAt,
        Instant updatedAt) {

    /** Map an entity to its response. Caller resolves the owner (batched — see CollectionService). */
    public static CollectionResponse from(Collection collection, User owner) {
        return new CollectionResponse(
                collection.getId(),
                owner.getId(),
                owner.getUsername(),
                owner.getAvatarMediaUrl(),
                owner.getAvatarMediaUrl() != null ? CropDto.from(owner.getAvatarCrop()) : null,
                collection.getName(),
                collection.getDescription(),
                collection.getVisibility(),
                collection.getCoverMediaId(),
                collection.getCoverUrl(),
                collection.getCoverUrl() != null ? CropDto.from(collection.getCoverCrop()) : null,
                collection.getArchivedAt(),
                collection.getCreatedAt(),
                collection.getUpdatedAt());
    }
}
