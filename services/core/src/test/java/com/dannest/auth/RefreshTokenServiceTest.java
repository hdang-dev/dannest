package com.dannest.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private StringRedisTemplate redis;

    @Mock
    private ValueOperations<String, String> valueOps;

    private RefreshTokenService service;

    @BeforeEach
    void setUp() {
        service = new RefreshTokenService(redis, 2_592_000L);
    }

    @Test
    void issuingATokenStoresTheUserIdInRedisWithTheConfiguredTtl() {
        when(redis.opsForValue()).thenReturn(valueOps);
        UUID userId = UUID.randomUUID();

        String token = service.issue(userId);

        assertThat(token).isNotBlank();
        verify(valueOps).set(eq("refresh:" + token), eq(userId.toString()), eq(Duration.ofSeconds(2_592_000L)));
    }

    @Test
    void rotatingAValidTokenRevokesItAndIssuesANewOne() {
        when(redis.opsForValue()).thenReturn(valueOps);
        UUID userId = UUID.randomUUID();
        when(valueOps.get("refresh:old-token")).thenReturn(userId.toString());

        RefreshTokenService.Rotated result = service.validateAndRotate("old-token");

        assertThat(result.userId()).isEqualTo(userId);
        assertThat(result.token()).isNotEqualTo("old-token");
        verify(redis).delete("refresh:old-token");
        verify(valueOps).set(anyString(), eq(userId.toString()), any(Duration.class));
    }

    @Test
    void rotatingAnUnknownTokenThrows() {
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("refresh:missing")).thenReturn(null);

        assertThatThrownBy(() -> service.validateAndRotate("missing")).isInstanceOf(InvalidTokenException.class);
    }

    @Test
    void revokingATokenDeletesItFromRedis() {
        service.revoke("some-token");

        verify(redis).delete("refresh:some-token");
    }
}
