package com.dannest.auth;

import com.dannest.auth.dto.AuthResponse;
import com.dannest.auth.dto.UserResponse;
import com.dannest.user.User;
import com.dannest.user.UserRepository;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final String PROVIDER = "GOOGLE";

    private final GoogleTokenVerifier googleVerifier;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public AuthService(GoogleTokenVerifier googleVerifier, JwtService jwtService, UserRepository userRepository) {
        this.googleVerifier = googleVerifier;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Transactional
    public AuthResponse loginWithGoogle(String idToken) {
        GoogleIdToken.Payload payload = googleVerifier.verify(idToken);

        if (!Boolean.TRUE.equals(payload.getEmailVerified())) {
            throw new InvalidTokenException("Google account email is not verified");
        }
        String sub = payload.getSubject();
        String email = payload.getEmail();
        String name = (String) payload.get("name");
        String picture = (String) payload.get("picture");
        if (email == null) {
            throw new InvalidTokenException("Google account has no email");
        }

        User user = userRepository.findByProviderAndProviderId(PROVIDER, sub)
                .map(existing -> {
                    existing.setAvatarUrl(picture);
                    return existing;
                })
                .orElseGet(() -> createUser(email, name, sub, picture));

        String token = jwtService.createToken(user);
        return new AuthResponse(token, UserResponse.from(user));
    }

    private User createUser(String email, String name, String sub, String picture) {
        String username = generateUsername(email, name);
        User user = User.forProvider(username, email, PROVIDER, sub, picture);
        return userRepository.save(user);
    }

    /** Derive a unique username from the email local-part (append a number on clash). */
    private String generateUsername(String email, String name) {
        String base = email.substring(0, email.indexOf('@')).toLowerCase().replaceAll("[^a-z0-9_]", "");
        if (base.isEmpty()) {
            base = "user";
        }
        if (base.length() > 40) {
            base = base.substring(0, 40);
        }
        String candidate = base;
        int i = 1;
        while (userRepository.existsByUsername(candidate)) {
            candidate = base + i++;
        }
        return candidate;
    }
}
