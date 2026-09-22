package com.dannest.inbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class IdempotencyTest {

    @Mock
    private InboxEventRepository repository;

    @InjectMocks
    private Idempotency idempotency;

    @Test
    void claimsAnEventSeenForTheFirstTime() {
        UUID eventId = UUID.randomUUID();
        when(repository.tryInsert(eventId, "core.membership")).thenReturn(1);

        assertThat(idempotency.claim(eventId, "core.membership")).isTrue();
    }

    @Test
    void rejectsARedeliveredEvent() {
        UUID eventId = UUID.randomUUID();
        when(repository.tryInsert(eventId, "core.membership")).thenReturn(0);

        assertThat(idempotency.claim(eventId, "core.membership")).isFalse();
    }
}
