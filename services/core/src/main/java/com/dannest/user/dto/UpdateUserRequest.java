package com.dannest.user.dto;

import com.dannest.common.CropDto;
import jakarta.validation.constraints.Size;

/**
 * Body of PATCH /api/v1/users/me — a partial update.
 *
 * <p>Every field is optional: a {@code null} field leaves the current value untouched.
 * Setting {@code avatarMediaId} replaces the avatar — the caller must also send
 * {@code avatarMediaUrl}/{@code avatarCrop} (the values services/media just returned for
 * that id), since Core no longer looks media up itself. {@code clearAvatar=true} removes it.
 */
public record UpdateUserRequest(
        @Size(max = 50) String username,
        String bio,
        String avatarMediaId,
        String avatarMediaUrl,
        CropDto avatarCrop,
        Boolean clearAvatar) {
}
