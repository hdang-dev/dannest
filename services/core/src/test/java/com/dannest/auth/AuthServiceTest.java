package com.dannest.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dannest.user.User;
import com.dannest.user.UserRepository;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private GoogleTokenVerifier googleVerifier;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AuthService authService;

    private GoogleIdToken.Payload payloadWith(boolean emailVerified, String email, String name) {
        GoogleIdToken.Payload payload = new GoogleIdToken.Payload();
        payload.setSubject("google-sub-1");
        payload.setEmailVerified(emailVerified);
        payload.setEmail(email);
        if (name != null) {
            payload.set("name", name);
        }
        payload.set("picture", "https://google/pic.jpg");
        return payload;
    }

    @Test
    void rejectsAnUnverifiedGoogleEmail() {
        when(googleVerifier.verify("token")).thenReturn(payloadWith(false, "dan@example.com", "Dan"));

        assertThatThrownBy(() -> authService.loginWithGoogle("token")).isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void rejectsATokenWithNoEmail() {
        when(googleVerifier.verify("token")).thenReturn(payloadWith(true, null, "Dan"));

        assertThatThrownBy(() -> authService.loginWithGoogle("token")).isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void updatesTheAvatarOfAnExistingUser() {
        when(googleVerifier.verify("token")).thenReturn(payloadWith(true, "dan@example.com", "Dan"));
        User existing = User.forProvider("dan", "dan@example.com", "GOOGLE", "google-sub-1", "old-pic.jpg");
        when(userRepository.findByProviderAndProviderId("GOOGLE", "google-sub-1"))
                .thenReturn(Optional.of(existing));

        User result = authService.loginWithGoogle("token");

        assertThat(result.getAvatarUrl()).isEqualTo("https://google/pic.jpg");
        verify(userRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void createsANewUserFromTheGoogleDisplayName() {
        when(googleVerifier.verify("token")).thenReturn(payloadWith(true, "dan@example.com", "Dan Nest"));
        when(userRepository.findByProviderAndProviderId("GOOGLE", "google-sub-1")).thenReturn(Optional.empty());
        when(userRepository.existsByUsername("dan_nest")).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User result = authService.loginWithGoogle("token");

        assertThat(result.getUsername()).isEqualTo("dan_nest");
        assertThat(result.getEmail()).isEqualTo("dan@example.com");
        assertThat(result.getProvider()).isEqualTo("GOOGLE");
    }

    @Test
    void fallsBackToTheEmailLocalPartWhenGoogleGivesNoName() {
        when(googleVerifier.verify("token")).thenReturn(payloadWith(true, "danthedev@example.com", null));
        when(userRepository.findByProviderAndProviderId("GOOGLE", "google-sub-1")).thenReturn(Optional.empty());
        when(userRepository.existsByUsername("danthedev")).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User result = authService.loginWithGoogle("token");

        assertThat(result.getUsername()).isEqualTo("danthedev");
    }

    @Test
    void appendsANumberWhenTheUsernameIsAlreadyTaken() {
        when(googleVerifier.verify("token")).thenReturn(payloadWith(true, "dan@example.com", "Dan"));
        when(userRepository.findByProviderAndProviderId("GOOGLE", "google-sub-1")).thenReturn(Optional.empty());
        when(userRepository.existsByUsername("dan")).thenReturn(true);
        when(userRepository.existsByUsername("dan1")).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User result = authService.loginWithGoogle("token");

        assertThat(result.getUsername()).isEqualTo("dan1");
    }
}
