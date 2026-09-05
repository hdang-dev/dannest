package com.dannest.outbox;

import com.dannest.config.RabbitConfig;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Publishes {@link OutboxEvent} rows RabbitMQ hasn't seen yet, oldest first. A failed
 * publish just leaves {@code published_at} null — picked up again next tick, no
 * special retry bookkeeping beyond {@code attempts}/{@code last_error} for visibility.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OutboxPoller {

    private static final int BATCH_SIZE = 100;

    private final OutboxEventRepository outboxEventRepository;
    private final RabbitTemplate rabbitTemplate;

    @Scheduled(fixedDelay = 1000)
    @Transactional
    public void publishPending() {
        List<OutboxEvent> batch =
                outboxEventRepository.findByPublishedAtIsNullOrderByCreatedAt(PageRequest.of(0, BATCH_SIZE));
        for (OutboxEvent event : batch) {
            try {
                // Raw bytes, not rabbitTemplate.convertAndSend(exchange, key, payload) —
                // the payload is already-serialized JSON (see OutboxWriter); converting
                // it back to an object just to have the converter re-serialize it would
                // be pointless round-tripping.
                Message message = MessageBuilder.withBody(event.getPayload().getBytes(StandardCharsets.UTF_8))
                        .setContentType(MessageProperties.CONTENT_TYPE_JSON)
                        .build();
                rabbitTemplate.send(RabbitConfig.EVENTS_EXCHANGE, event.getEventType(), message);
                event.setPublishedAt(Instant.now());
            } catch (RuntimeException ex) {
                event.setAttempts(event.getAttempts() + 1);
                event.setLastError(ex.getMessage());
                log.warn("Failed to publish outbox event {} ({}): {}",
                        event.getId(), event.getEventType(), ex.getMessage());
            }
        }
        outboxEventRepository.saveAll(batch);
    }
}
