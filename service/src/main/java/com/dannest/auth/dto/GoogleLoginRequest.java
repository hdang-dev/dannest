package com.dannest.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** Body of POST /api/v1/auth/google — the Google ID token from the frontend. */
public record GoogleLoginRequest(@NotBlank String idToken) {
}
