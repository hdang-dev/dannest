package com.dannest.event;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import com.dannest.config.RabbitConfig;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

@ExtendWith(MockitoExtension.class)
class EventPublisherTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private EventPublisher publisher;

    private DannestEvent sampleEvent() {
        return new DannestEvent(
                "NEW_POST", UUID.randomUUID(), UUID.randomUUID(), "author", null,
                UUID.randomUUID(), "Collection", UUID.randomUUID(), null, Instant.now());
    }

    @Test
    void publishesToTheEventsExchangeUnderTheEventTypeRoutingKey() {
        DannestEvent event = sampleEvent();

        publisher.publish(event);

        verify(rabbitTemplate).convertAndSend(RabbitConfig.EVENTS_EXCHANGE, "NEW_POST", event);
    }

    @Test
    void aBrokerFailureIsSwallowedInsteadOfBreakingTheCaller() {
        doThrow(new AmqpException("broker unreachable"))
                .when(rabbitTemplate).convertAndSend(anyString(), anyString(), any(DannestEvent.class));

        // Must not throw.
        publisher.publish(sampleEvent());
    }
}
