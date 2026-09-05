package com.dannest.outbox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Call this from inside a caller's own {@code @Transactional} method, right alongside
 * the business write it accompanies — it joins that same transaction (no {@code
 * REQUIRES_NEW} here), which is the entire point: both rows commit together, or
 * neither does.
 */
@Component
@RequiredArgsConstructor
public class OutboxWriter {

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public void write(String aggregateType, String aggregateId, String eventType, Object payload) {
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            // A payload record that can't serialize is a programming error, not a
            // runtime condition to swallow — unlike EventPublisher's best-effort
            // publish, the whole point of the outbox is that this write must not
            // silently fail.
            throw new IllegalStateException("Could not serialize outbox payload for " + eventType, e);
        }
        outboxEventRepository.save(OutboxEvent.builder()
                .aggregateType(aggregateType)
                .aggregateId(aggregateId)
                .eventType(eventType)
                .payload(json)
                .createdAt(Instant.now())
                .build());
    }
}
