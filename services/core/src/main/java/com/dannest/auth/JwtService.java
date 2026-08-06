package com.dannest.auth;

import com.dannest.user.User;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/**
 * Issues our own signed access token (HS256, short-lived) for a logged-in user.
 * The refresh token is a separate, opaque value — see {@link RefreshTokenService}.
 */
@Service
public class JwtService {

    private final JwtEncoder encoder;
    private final long expirySeconds;

    public JwtService(
            JwtEncoder encoder, @Value("${jwt.access-token-expiration-seconds}") long expirySeconds) {
        this.encoder = encoder;
        this.expirySeconds = expirySeconds;
    }

    public String createAccessToken(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("dannest")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(expirySeconds))
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("username", user.getUsername())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
