package com.dannest.event;

import com.dannest.activity.ActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/** Consumes Core's {@code ACTIVITY_*} domain events off the {@code activity.events} queue (see RabbitConfig). */
@Component
@RequiredArgsConstructor
public class ActivityEventConsumer {

    private final ActivityService activityService;

    @RabbitListener(queues = "activity.events")
    public void onEvent(DannestEvent event) {
        activityService.recordFromEvent(event);
    }
}
