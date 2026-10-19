package com.dannest.outbox;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Publishes new outbox rows as soon as their transaction commits. Hands off to the
 * scheduler thread instead of running inline: the request doesn't wait on RabbitMQ,
 * and since the poller's sweep uses the same single thread (spring.task.scheduling
 * .pool.size: 1), two runs can never publish the same row twice.
 */
@Component
@RequiredArgsConstructor
public class OutboxRelayTrigger {

    private final OutboxPoller outboxPoller;
    private final TaskScheduler taskScheduler;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOutboxEventWritten(OutboxEventWritten event) {
        taskScheduler.schedule(outboxPoller::publishPending, Instant.now());
    }
}
