package com.dannest.user.dto;

import com.dannest.media.Media;
import com.dannest.media.dto.CropDto;
import com.dannest.user.User;
import java.time.Instant;
import java.util.UUID;

/**
 * API view of a user's profile.
 *
 * <p>{@code avatarUrl}/{@code avatarCrop} are sourced only from {@link User#getAvatar()}
 * (a user-uploaded or embedded {@link Media}) — never from the legacy OAuth
 * {@code avatarUrl} string, which is provider bookkeeping, not the profile photo.
 *
 * <p>{@code email} is only populated for the profile owner — other viewers must not see it.
 */
public record UserProfileResponse(
        UUID id,
        String username,
        String email,
        String bio,
        UUID avatarMediaId,
        String avatarUrl,
        CropDto avatarCrop,
        Instant createdAt,
        Instant updatedAt) {

    /**
     * Map an entity to its response. Must run inside a transaction (touches lazy fields).
     * {@code includeEmail} should only be true when the caller is viewing their own profile.
     */
    public static UserProfileResponse from(User user, boolean includeEmail) {
        Media avatar = user.getAvatar();
        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                includeEmail ? user.getEmail() : null,
                user.getBio(),
                avatar != null ? avatar.getId() : null,
                avatar != null ? avatar.getUrl() : null,
                avatar != null ? CropDto.from(avatar.getCrop()) : null,
                user.getCreatedAt(),
                user.getUpdatedAt());
    }
}
