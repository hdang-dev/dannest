package com.dannest.event;

import com.dannest.activity.ActivityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/**
 * Consumes Core's {@code core.activity.*} events off the {@code notification.activity.q}
 * queue (see RabbitConfig). Rejects without requeue on any failure — see {@link
 * EventConsumer}'s javadoc for why.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ActivityEventConsumer {

    private final ActivityService activityService;

    @RabbitListener(queues = "notification.activity.q")
    public void onEvent(DannestEvent event) {
        try {
            activityService.recordFromEvent(event);
        } catch (Exception e) {
            log.error("Failed to record activity for event {}, sending to DLQ", event, e);
            throw new AmqpRejectAndDontRequeueException(e);
        }
    }
}
