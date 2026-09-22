package com.dannest.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dannest.user.User;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class JwtServiceTest {

    @Mock
    private JwtEncoder encoder;

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(encoder, 900L);
    }

    @Test
    void encodesTheUsersIdAsTheSubjectWithA15MinuteExpiry() {
        User user = User.forProvider("dan", "dan@example.com", "GOOGLE", "sub-1", null);
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        Jwt fakeJwt = fakeJwt("signed-token-value");
        when(encoder.encode(any())).thenReturn(fakeJwt);

        String token = jwtService.createAccessToken(user);

        assertThat(token).isEqualTo("signed-token-value");
        ArgumentCaptor<JwtEncoderParameters> captor = ArgumentCaptor.forClass(JwtEncoderParameters.class);
        verify(encoder).encode(captor.capture());
        var claims = captor.getValue().getClaims();
        assertThat(claims.getSubject()).isEqualTo(user.getId().toString());
        String email = claims.getClaim("email");
        String username = claims.getClaim("username");
        assertThat(email).isEqualTo("dan@example.com");
        assertThat(username).isEqualTo("dan");
        assertThat(claims.getExpiresAt()).isEqualTo(claims.getIssuedAt().plusSeconds(900));
    }

    private static Jwt fakeJwt(String tokenValue) {
        return Jwt.withTokenValue(tokenValue)
                .header("alg", "HS256")
                .claim("sub", "irrelevant-for-this-test")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(900))
                .build();
    }
}
