package com.dannest.auth;

import com.dannest.auth.dto.AuthResponse;
import com.dannest.auth.dto.GoogleLoginRequest;
import com.dannest.auth.dto.UserResponse;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;

    private final String cookieName;
    private final boolean cookieSecure;
    private final String cookieSameSite;
    private final long refreshTtlSeconds;

    public AuthController(
            AuthService authService,
            UserRepository userRepository,
            JwtService jwtService,
            RefreshTokenService refreshTokenService,
            @Value("${jwt.refresh-cookie.name}") String cookieName,
            @Value("${jwt.refresh-cookie.secure}") boolean cookieSecure,
            @Value("${jwt.refresh-cookie.same-site}") String cookieSameSite,
            @Value("${jwt.refresh-token-expiration-seconds}") long refreshTtlSeconds) {
        this.authService = authService;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.cookieName = cookieName;
        this.cookieSecure = cookieSecure;
        this.cookieSameSite = cookieSameSite;
        this.refreshTtlSeconds = refreshTtlSeconds;
    }

    /** Exchange a Google ID token for our own session (public endpoint). */
    @PostMapping("/google")
    public AuthResponse google(@Valid @RequestBody GoogleLoginRequest request, HttpServletResponse response) {
        User user = authService.loginWithGoogle(request.idToken());
        return issueSession(user, response);
    }

    /**
     * Exchange the refresh cookie for a new access token. The refresh token is
     * single-use: a valid call also rotates it, so a stolen-but-already-used token
     * stops working the next time the real user refreshes.
     */
    @PostMapping("/refresh")
    public AuthResponse refresh(
            @CookieValue(name = "${jwt.refresh-cookie.name}", required = false) String refreshToken,
            HttpServletResponse response) {
        if (refreshToken == null) {
            throw new InvalidTokenException("No refresh token");
        }
        RefreshTokenService.Rotated rotated = refreshTokenService.validateAndRotate(refreshToken);
        User user = userRepository.findById(rotated.userId())
                .orElseThrow(() -> new InvalidTokenException("User not found"));
        setRefreshCookie(response, rotated.token());
        String accessToken = jwtService.createAccessToken(user);
        return new AuthResponse(accessToken, UserResponse.from(user));
    }

    /** Revokes the refresh token (Redis) and clears the cookie. Never fails just
     * because the access token was already expired — logout should always succeed. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = "${jwt.refresh-cookie.name}", required = false) String refreshToken,
            HttpServletResponse response) {
        if (refreshToken != null) {
            refreshTokenService.revoke(refreshToken);
        }
        clearRefreshCookie(response);
        return ResponseEntity.noContent().build();
    }

    /** The currently authenticated user (requires a valid Bearer token). */
    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        UUID id = UUID.fromString(jwt.getSubject());
        User user = userRepository.findById(id)
                .orElseThrow(() -> new InvalidTokenException("User not found"));
        return UserResponse.from(user);
    }

    private AuthResponse issueSession(User user, HttpServletResponse response) {
        String accessToken = jwtService.createAccessToken(user);
        String refreshToken = refreshTokenService.issue(user.getId());
        setRefreshCookie(response, refreshToken);
        return new AuthResponse(accessToken, UserResponse.from(user));
    }

    private void setRefreshCookie(HttpServletResponse response, String token) {
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(token, refreshTtlSeconds).toString());
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie("", 0).toString());
    }

    private ResponseCookie buildCookie(String value, long maxAgeSeconds) {
        return ResponseCookie.from(cookieName, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/api/v1/auth")
                .maxAge(maxAgeSeconds)
                .build();
    }
}
