package com.dannest.user.dto;

import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Body of PATCH /api/v1/users/me — a partial update.
 *
 * <p>Every field is optional: a {@code null} field leaves the current value untouched.
 * Setting {@code avatarMediaId} replaces the avatar; {@code clearAvatar=true} removes it.
 */
public record UpdateUserRequest(
        @Size(max = 50) String username,
        String bio,
        UUID avatarMediaId,
        Boolean clearAvatar) {
}
