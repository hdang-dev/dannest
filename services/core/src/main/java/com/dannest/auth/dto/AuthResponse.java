package com.dannest.auth.dto;

/** Returned after a successful login: our app JWT + the user profile. */
public record AuthResponse(String accessToken, UserResponse user) {
}
