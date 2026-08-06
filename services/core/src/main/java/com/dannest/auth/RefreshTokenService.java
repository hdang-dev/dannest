package com.dannest.auth;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Tracks refresh tokens in Redis so they can be revoked (logout) — something a plain
 * JWT can never do, since its signature is valid until it expires no matter what.
 *
 * <p>Key: {@code refresh:<token>} -> the user id, with a TTL matching the token's
 * lifetime. Losing Redis just means affected users have to log in again; nothing
 * else depends on this data surviving, so it's never written to Postgres.
 */
@Service
public class RefreshTokenService {

    private static final String KEY_PREFIX = "refresh:";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final StringRedisTemplate redis;
    private final Duration ttl;

    public RefreshTokenService(
            StringRedisTemplate redis,
            @Value("${jwt.refresh-token-expiration-seconds}") long ttlSeconds) {
        this.redis = redis;
        this.ttl = Duration.ofSeconds(ttlSeconds);
    }

    /** Mints a new refresh token for the user and stores it in Redis. */
    public String issue(UUID userId) {
        String token = generateToken();
        redis.opsForValue().set(KEY_PREFIX + token, userId.toString(), ttl);
        return token;
    }

    /**
     * Looks up the user a refresh token belongs to and rotates it: the old token is
     * revoked and a new one issued, so a refresh token is only ever valid for a
     * single use. Throws if the token is missing, expired, or already used.
     */
    public Rotated validateAndRotate(String token) {
        String userId = redis.opsForValue().get(KEY_PREFIX + token);
        if (userId == null) {
            throw new InvalidTokenException("Refresh token is invalid or expired");
        }
        redis.delete(KEY_PREFIX + token);
        String newToken = issue(UUID.fromString(userId));
        return new Rotated(UUID.fromString(userId), newToken);
    }

    /** Revokes a refresh token immediately (logout). No-op if it doesn't exist. */
    public void revoke(String token) {
        redis.delete(KEY_PREFIX + token);
    }

    private static String generateToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        // UUID prefix adds no security value, just keeps tokens greppable-unique in logs.
        return UUID.randomUUID() + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public record Rotated(UUID userId, String token) {
    }
}
