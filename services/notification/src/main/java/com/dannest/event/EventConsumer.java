package com.dannest.event;

import com.dannest.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/** Consumes Core's domain events off the {@code notification.events} queue (see RabbitConfig). */
@Component
@RequiredArgsConstructor
public class EventConsumer {

    private final NotificationService notificationService;

    @RabbitListener(queues = "notification.events")
    public void onEvent(DannestEvent event) {
        notificationService.recordFromEvent(event);
    }
}
