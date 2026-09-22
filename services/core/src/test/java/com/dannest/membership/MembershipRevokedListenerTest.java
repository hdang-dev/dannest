package com.dannest.membership;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dannest.inbox.Idempotency;
import com.dannest.membership.event.MembershipSettleFailedEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;

@ExtendWith(MockitoExtension.class)
class MembershipRevokedListenerTest {

    @Mock
    private Idempotency idempotency;

    @Mock
    private MembershipService membershipService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private MembershipRevokedListener listener;

    @BeforeEach
    void setUp() {
        listener = new MembershipRevokedListener(objectMapper, idempotency, membershipService);
    }

    private Message messageFor(MembershipSettleFailedEvent event) throws Exception {
        return new Message(objectMapper.writeValueAsBytes(event), new MessageProperties());
    }

    @Test
    void dropsAMalformedPayloadWithoutThrowing() {
        Message malformed = new Message("not json".getBytes(StandardCharsets.UTF_8), new MessageProperties());

        listener.onSettleFailed(malformed);

        verify(idempotency, never()).claim(any(), any());
    }

    @Test
    void skipsADuplicateDeliveryWithoutProcessingIt() throws Exception {
        MembershipSettleFailedEvent event = new MembershipSettleFailedEvent(UUID.randomUUID(), "purchase-1");
        when(idempotency.claim(event.eventId(), "core.membership.revoke")).thenReturn(false);

        listener.onSettleFailed(messageFor(event));

        verify(membershipService, never()).revokeForSettleFailure(any());
    }

    @Test
    void revokesTheMembershipOnceClaimed() throws Exception {
        MembershipSettleFailedEvent event = new MembershipSettleFailedEvent(UUID.randomUUID(), "purchase-1");
        when(idempotency.claim(event.eventId(), "core.membership.revoke")).thenReturn(true);

        listener.onSettleFailed(messageFor(event));

        verify(membershipService).revokeForSettleFailure("purchase-1");
    }

    @Test
    void sendsToTheDlqInsteadOfRequeueingWhenProcessingFails() throws Exception {
        MembershipSettleFailedEvent event = new MembershipSettleFailedEvent(UUID.randomUUID(), "purchase-1");
        when(idempotency.claim(event.eventId(), "core.membership.revoke")).thenReturn(true);
        doThrow(new RuntimeException("db down")).when(membershipService).revokeForSettleFailure("purchase-1");

        assertThatThrownBy(() -> listener.onSettleFailed(messageFor(event)))
                .isInstanceOf(AmqpRejectAndDontRequeueException.class);
    }
}
