package com.dannest.auth.dto;

import com.dannest.media.Media;
import com.dannest.media.dto.CropDto;
import com.dannest.user.User;
import java.util.UUID;

/**
 * {@code avatarUrl}/{@code avatarCrop} are sourced only from {@link User#getAvatar()} (a
 * user-uploaded or embedded {@link Media}) — never from the legacy OAuth {@code avatarUrl}
 * string, which is provider bookkeeping, not the profile photo.
 */
public record UserResponse(UUID id, String username, String email, String avatarUrl, CropDto avatarCrop) {

    public static UserResponse from(User user) {
        Media avatar = user.getAvatar();
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                avatar != null ? avatar.getUrl() : null,
                avatar != null ? CropDto.from(avatar.getCrop()) : null);
    }
}
