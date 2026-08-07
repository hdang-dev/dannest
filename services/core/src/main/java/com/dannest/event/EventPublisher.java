package com.dannest.event;

import com.dannest.config.RabbitConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

/**
 * Publishes domain events to the {@code dannest.events} exchange, routed by event type.
 *
 * <p>Best-effort only: a broker outage must never break the write path that triggered the
 * event (e.g. creating a post). {@code RabbitTemplate.convertAndSend()} can throw if it
 * can't reach the broker within {@code connection-timeout} — left unguarded, that exception
 * would roll back the caller's transaction, so we catch and log instead of letting it
 * propagate.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EventPublisher {

    private final RabbitTemplate rabbitTemplate;

    /** Routing key is the event type, so a future consumer can bind to only what it needs. */
    public void publish(DannestEvent event) {
        try {
            rabbitTemplate.convertAndSend(RabbitConfig.EVENTS_EXCHANGE, event.eventType(), event);
        } catch (RuntimeException ex) {
            log.warn("Failed to publish {} event for recipient {}: {}",
                    event.eventType(), event.recipientId(), ex.getMessage());
        }
    }
}
