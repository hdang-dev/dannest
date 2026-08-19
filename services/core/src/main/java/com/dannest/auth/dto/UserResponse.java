package com.dannest.auth.dto;

import com.dannest.common.CropDto;
import com.dannest.user.User;
import java.util.UUID;

/**
 * {@code avatarUrl}/{@code avatarCrop} are sourced only from the user's own denormalized
 * {@code avatarMediaUrl}/{@code avatarCrop} snapshot (see services/media) — never from the
 * legacy OAuth {@code avatarUrl} string, which is provider bookkeeping, not the profile photo.
 */
public record UserResponse(UUID id, String username, String email, String avatarUrl, CropDto avatarCrop) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getAvatarMediaUrl(),
                user.getAvatarMediaUrl() != null ? CropDto.from(user.getAvatarCrop()) : null);
    }
}
