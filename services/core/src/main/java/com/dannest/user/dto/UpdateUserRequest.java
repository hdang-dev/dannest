package com.dannest.user.dto;

import com.dannest.common.CropDto;
import jakarta.validation.constraints.Size;

/**
 * Body of PATCH /api/v1/users/me — a partial update.
 *
 * <p>Every field is optional: a {@code null} field leaves the current value untouched.
 * Setting {@code avatarMediaId} replaces the avatar — the caller must also send
 * {@code avatarMediaUrl}/{@code avatarCrop} (the values the {@code POST /api/v1/media}
 * response returned for that id) — reads use the snapshot, not a live {@code media}
 * lookup. {@code clearAvatar=true} removes it.
 */
public record UpdateUserRequest(
        @Size(max = 50) String username,
        String bio,
        String avatarMediaId,
        String avatarMediaUrl,
        CropDto avatarCrop,
        Boolean clearAvatar) {
}
