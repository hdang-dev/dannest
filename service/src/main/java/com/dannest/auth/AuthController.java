package com.dannest.auth;

import com.dannest.auth.dto.AuthResponse;
import com.dannest.auth.dto.GoogleLoginRequest;
import com.dannest.auth.dto.UserResponse;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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

    public AuthController(AuthService authService, UserRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }

    /** Exchange a Google ID token for our app JWT (public endpoint). */
    @PostMapping("/google")
    public AuthResponse google(@Valid @RequestBody GoogleLoginRequest request) {
        return authService.loginWithGoogle(request.idToken());
    }

    /** The currently authenticated user (requires a valid Bearer token). */
    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        UUID id = UUID.fromString(jwt.getSubject());
        User user = userRepository.findById(id)
                .orElseThrow(() -> new InvalidTokenException("User not found"));
        return UserResponse.from(user);
    }
}
