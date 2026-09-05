package com.dannest.membership;

import com.dannest.inbox.Idempotency;
import com.dannest.membership.event.PurchaseInitiatedEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Consumes services/marketplace's half of the membership-purchase saga. Takes the raw
 * {@link Message} rather than a typed parameter — Spring AMQP would otherwise apply the
 * registered {@code MessageConverter} even to a failed/malformed payload, and a
 * conversion exception is treated the same as one thrown from inside the method (Spring's
 * default requeue-on-exception, which is how this codebase already got bitten by an
 * infinite redelivery loop once — see notification's RabbitConfig javadoc). Parsing by
 * hand means a malformed message can be logged and dropped instead of retried forever.
 *
 * <p>{@link #membershipService}'s own processing is guarded the same way, for the same
 * reason: a deterministic failure there (bad data, a bug) is just as capable of looping
 * forever as a malformed payload is, and Spring's default error handler only routes a
 * message to this queue's DLQ for exceptions it considers "fatal" — a plain business
 * exception isn't one, so without this it would requeue and retry identically forever
 * instead of ever reaching the DLQ its own queue definition promises.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MembershipSagaListener {

    private static final String CONSUMER = "core.membership";

    private final ObjectMapper objectMapper;
    private final Idempotency idempotency;
    private final MembershipService membershipService;

    @RabbitListener(queues = "core.marketplace")
    @Transactional
    public void onPurchaseInitiated(Message message) {
        PurchaseInitiatedEvent event;
        try {
            event = objectMapper.readValue(
                    new String(message.getBody(), StandardCharsets.UTF_8), PurchaseInitiatedEvent.class);
        } catch (Exception e) {
            log.error("Malformed purchase_initiated payload, dropping: {}", e.getMessage());
            return;
        }

        if (!idempotency.claim(event.eventId(), CONSUMER)) {
            log.info("Duplicate purchase_initiated {} for purchase {}, skipping",
                    event.eventId(), event.purchaseId());
            return;
        }

        try {
            membershipService.processPurchase(event);
        } catch (Exception e) {
            log.error("Failed to process purchase_initiated for purchase {}, sending to DLQ",
                    event.purchaseId(), e);
            throw new AmqpRejectAndDontRequeueException(e);
        }
    }
}
