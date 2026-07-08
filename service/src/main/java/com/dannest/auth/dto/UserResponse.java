package com.dannest.auth.dto;

import com.dannest.user.User;
import java.util.UUID;

public record UserResponse(UUID id, String username, String email, String avatarUrl) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getUsername(), user.getEmail(), user.getAvatarUrl());
    }
}
