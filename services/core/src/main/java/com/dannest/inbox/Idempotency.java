package com.dannest.inbox;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Call {@link #claim} as the very first thing a {@code @RabbitListener} method does,
 * in the same transaction as everything else it's about to do. If it returns {@code
 * false}, stop — this exact event has already been handled (RabbitMQ redelivers on
 * things as ordinary as a slow ack, not just real failures), and doing the work again
 * would double it (e.g. grant a membership twice).
 */
@Component
@RequiredArgsConstructor
public class Idempotency {

    private final InboxEventRepository inboxEventRepository;

    public boolean claim(UUID eventId, String consumer) {
        return inboxEventRepository.tryInsert(eventId, consumer) == 1;
    }
}
