package com.dannest.collection.dto;

import com.dannest.collection.Collection;
import com.dannest.collection.Visibility;
import com.dannest.media.Media;
import com.dannest.media.dto.CropDto;
import com.dannest.user.User;
import java.time.Instant;
import java.util.UUID;

/**
 * API view of a collection.
 *
 * <p>{@code ownerAvatarUrl}/{@code ownerAvatarCrop} are sourced only from the owner's
 * uploaded/embedded {@code Media} avatar — never the legacy OAuth avatar string.
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
        UUID coverMediaId,
        String coverUrl,
        CropDto coverCrop,
        Instant archivedAt,
        Instant createdAt,
        Instant updatedAt) {

    /** Map an entity to its response. Must run inside a transaction (touches lazy fields). */
    public static CollectionResponse from(Collection collection) {
        Media cover = collection.getCover();
        User owner = collection.getOwner();
        Media ownerAvatar = owner.getAvatar();
        return new CollectionResponse(
                collection.getId(),
                owner.getId(),
                owner.getUsername(),
                ownerAvatar != null ? ownerAvatar.getUrl() : null,
                ownerAvatar != null ? CropDto.from(ownerAvatar.getCrop()) : null,
                collection.getName(),
                collection.getDescription(),
                collection.getVisibility(),
                cover != null ? cover.getId() : null,
                cover != null ? cover.getUrl() : null,
                cover != null ? CropDto.from(cover.getCrop()) : null,
                collection.getArchivedAt(),
                collection.getCreatedAt(),
                collection.getUpdatedAt());
    }
}
