package com.dannest.user.dto;

import com.dannest.common.CropDto;
import com.dannest.user.User;
import java.time.Instant;
import java.util.UUID;

/**
 * API view of a user's profile.
 *
 * <p>{@code avatarUrl}/{@code avatarCrop} are sourced only from the user's own
 * denormalized {@code avatarMediaUrl}/{@code avatarCrop} snapshot (see services/media) —
 * never from the legacy OAuth {@code avatarUrl} string, which is provider bookkeeping,
 * not the profile photo.
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

    /** {@code includeEmail} should only be true when the caller is viewing their own profile. */
    public static UserProfileResponse from(User user, boolean includeEmail) {
        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                includeEmail ? user.getEmail() : null,
                user.getBio(),
                user.getAvatarMediaId(),
                user.getAvatarMediaUrl(),
                user.getAvatarMediaUrl() != null ? CropDto.from(user.getAvatarCrop()) : null,
                user.getCreatedAt(),
                user.getUpdatedAt());
    }
}
