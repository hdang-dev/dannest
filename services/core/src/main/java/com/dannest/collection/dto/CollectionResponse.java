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
 *
 * <p>{@code priceCents} is set only for {@code MEMBERS_ONLY} collections. {@code
 * viewerHasMembership} is {@code true} for a non-owner viewer with an active {@code
 * collection_membership} row — always {@code false} for the owner (they don't need one)
 * and for non-{@code MEMBERS_ONLY} collections.
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
        Integer priceCents,
        boolean viewerHasMembership,
        String coverMediaId,
        String coverUrl,
        CropDto coverCrop,
        Instant archivedAt,
        Instant createdAt,
        Instant updatedAt) {

    /** Map an entity to its response. Caller resolves the owner + membership (batched — see CollectionService). */
    public static CollectionResponse from(Collection collection, User owner, boolean viewerHasMembership) {
        return new CollectionResponse(
                collection.getId(),
                owner.getId(),
                owner.getUsername(),
                owner.getAvatarMediaUrl(),
                owner.getAvatarMediaUrl() != null ? CropDto.from(owner.getAvatarCrop()) : null,
                collection.getName(),
                collection.getDescription(),
                collection.getVisibility(),
                collection.getPriceCents(),
                viewerHasMembership,
                collection.getCoverMediaId(),
                collection.getCoverUrl(),
                collection.getCoverUrl() != null ? CropDto.from(collection.getCoverCrop()) : null,
                collection.getArchivedAt(),
                collection.getCreatedAt(),
                collection.getUpdatedAt());
    }
}
