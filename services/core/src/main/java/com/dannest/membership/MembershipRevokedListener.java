package com.dannest.membership;

import com.dannest.inbox.Idempotency;
import com.dannest.membership.event.MembershipSettleFailedEvent;
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
 * Compensation #2's other half. {@link MembershipSagaListener} grants a membership on
 * {@code purchase_initiated}; if services/marketplace then fails to pay the creator (the
 * settle step), it refunds the buyer and publishes {@code mkt.membership.settle_failed}
 * so Core can undo that grant — otherwise a refunded buyer would keep a month of free
 * access. On its own queue/DLQ rather than sharing {@code core.marketplace} with the
 * purchase-initiated listener: that listener parses every message strictly as {@link
 * com.dannest.membership.event.PurchaseInitiatedEvent}, so a settle_failed message on
 * the same queue would just fail to parse and be dropped as malformed.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MembershipRevokedListener {

    private static final String CONSUMER = "core.membership.revoke";

    private final ObjectMapper objectMapper;
    private final Idempotency idempotency;
    private final MembershipService membershipService;

    @RabbitListener(queues = "core.marketplace.settle-failed")
    @Transactional
    public void onSettleFailed(Message message) {
        MembershipSettleFailedEvent event;
        try {
            event = objectMapper.readValue(
                    new String(message.getBody(), StandardCharsets.UTF_8), MembershipSettleFailedEvent.class);
        } catch (Exception e) {
            log.error("Malformed settle_failed payload, dropping: {}", e.getMessage());
            return;
        }

        if (!idempotency.claim(event.eventId(), CONSUMER)) {
            log.info("Duplicate settle_failed {} for purchase {}, skipping", event.eventId(), event.purchaseId());
            return;
        }

        try {
            membershipService.revokeForSettleFailure(event.purchaseId());
        } catch (Exception e) {
            // Same "no retry, straight to the DLQ" policy as MembershipSagaListener — see
            // its javadoc for why a plain exception here would otherwise loop forever.
            log.error("Failed to process settle_failed for purchase {}, sending to DLQ",
                    event.purchaseId(), e);
            throw new AmqpRejectAndDontRequeueException(e);
        }
    }
}
