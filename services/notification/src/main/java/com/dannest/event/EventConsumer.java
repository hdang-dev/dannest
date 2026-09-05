package com.dannest.event;

import com.dannest.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/**
 * Consumes Core's domain events off the {@code notification.events} queue (see RabbitConfig).
 *
 * <p>Any exception from {@link #notificationService} — not just an unrecognized {@code
 * NotificationType} — is rejected without requeue instead of left to Spring's default
 * indefinite-requeue-and-retry: a deterministic failure here (bad data, a bug) would
 * otherwise redeliver and fail identically forever, the exact infinite loop this queue's
 * binding was narrowed to prevent in the first place (see RabbitConfig's javadoc) — just
 * for a different trigger. It now lands in this queue's DLQ instead.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EventConsumer {

    private final NotificationService notificationService;

    @RabbitListener(queues = "notification.events")
    public void onEvent(DannestEvent event) {
        try {
            notificationService.recordFromEvent(event);
        } catch (Exception e) {
            log.error("Failed to record notification for event {}, sending to DLQ", event, e);
            throw new AmqpRejectAndDontRequeueException(e);
        }
    }
}
