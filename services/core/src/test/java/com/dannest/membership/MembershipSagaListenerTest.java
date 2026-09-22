package com.dannest.membership;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dannest.inbox.Idempotency;
import com.dannest.membership.event.PurchaseInitiatedEvent;
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
class MembershipSagaListenerTest {

    @Mock
    private Idempotency idempotency;

    @Mock
    private MembershipService membershipService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private MembershipSagaListener listener;

    @BeforeEach
    void setUp() {
        listener = new MembershipSagaListener(objectMapper, idempotency, membershipService);
    }

    private Message messageFor(PurchaseInitiatedEvent event) throws Exception {
        return new Message(objectMapper.writeValueAsBytes(event), new MessageProperties());
    }

    @Test
    void dropsAMalformedPayloadWithoutThrowing() {
        Message malformed = new Message("not json".getBytes(StandardCharsets.UTF_8), new MessageProperties());

        listener.onPurchaseInitiated(malformed);

        verify(idempotency, never()).claim(any(), any());
    }

    @Test
    void skipsADuplicateDeliveryWithoutProcessingIt() throws Exception {
        PurchaseInitiatedEvent event =
                new PurchaseInitiatedEvent(UUID.randomUUID(), "purchase-1", UUID.randomUUID(), UUID.randomUUID(), 500);
        when(idempotency.claim(event.eventId(), "core.membership")).thenReturn(false);

        listener.onPurchaseInitiated(messageFor(event));

        verify(membershipService, never()).processPurchase(any());
    }

    @Test
    void processesANewEventOnceClaimed() throws Exception {
        PurchaseInitiatedEvent event =
                new PurchaseInitiatedEvent(UUID.randomUUID(), "purchase-1", UUID.randomUUID(), UUID.randomUUID(), 500);
        when(idempotency.claim(event.eventId(), "core.membership")).thenReturn(true);

        listener.onPurchaseInitiated(messageFor(event));

        verify(membershipService).processPurchase(event);
    }

    @Test
    void sendsToTheDlqInsteadOfRequeueingWhenProcessingFails() throws Exception {
        PurchaseInitiatedEvent event =
                new PurchaseInitiatedEvent(UUID.randomUUID(), "purchase-1", UUID.randomUUID(), UUID.randomUUID(), 500);
        when(idempotency.claim(event.eventId(), "core.membership")).thenReturn(true);
        doThrow(new RuntimeException("db down")).when(membershipService).processPurchase(event);

        assertThatThrownBy(() -> listener.onPurchaseInitiated(messageFor(event)))
                .isInstanceOf(AmqpRejectAndDontRequeueException.class);
    }
}
