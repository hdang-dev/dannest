package com.dannest.auth;

import com.dannest.user.User;
import com.dannest.user.UserRepository;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String PROVIDER = "GOOGLE";

    private final GoogleTokenVerifier googleVerifier;
    private final UserRepository userRepository;

    /** Verifies the Google ID token and finds or creates the matching user. Minting our
     * own tokens is the caller's job (see AuthController) — this is Google-specific. */
    @Transactional
    public User loginWithGoogle(String idToken) {
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

        return userRepository.findByProviderAndProviderId(PROVIDER, sub)
                .map(existing -> {
                    existing.setAvatarUrl(picture);
                    return existing;
                })
                .orElseGet(() -> createUser(email, name, sub, picture));
    }

    private User createUser(String email, String name, String sub, String picture) {
        String username = generateUsername(email, name);
        User user = User.forProvider(username, email, PROVIDER, sub, picture);
        return userRepository.save(user);
    }

    /**
     * Derive a unique username, preferring Google's display name (so new users get a
     * recognizable handle instead of an email fragment); falls back to the email
     * local-part if Google gave no usable name. Appends a number on clash.
     */
    private String generateUsername(String email, String name) {
        String base = slugify(name);
        if (base.isEmpty()) {
            base = email.substring(0, email.indexOf('@')).toLowerCase().replaceAll("[^a-z0-9_]", "");
        }
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

    private static String slugify(String name) {
        if (name == null) {
            return "";
        }
        return name.toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
    }
}
