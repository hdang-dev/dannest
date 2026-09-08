package com.dannest.config;

import com.dannest.activity.ActivityType;
import com.dannest.notification.NotificationType;
import java.util.Arrays;
import java.util.List;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JavaTypeMapper.TypePrecedence;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Declares this service's queues against Core's {@code dannest.events} exchange (properties
 * must match Core's declaration or RabbitMQ rejects it).
 *
 * <p>Two independent consumers share this one exchange, each bound to only the routing keys
 * it understands — the exact scenario a topic exchange is for. Bindings are derived from
 * the {@link NotificationType} / {@link ActivityType} enums' {@code routingKey}s, so they
 * can't drift from what those consumers actually handle. Explicit keys, never a wildcard:
 * Core also publishes {@code core.activity.*} events, and {@code EventConsumer} would throw
 * on one of those ({@code NotificationType.fromRoutingKey(...)}) — which, left unguarded,
 * turns Spring AMQP's default requeue-on-exception into an infinite redelivery loop.
 *
 * <p>Both queues carry a dead-letter queue — the routing above only closes one failure
 * mode (an unrecognized key reaching a listener). Any other exception from a consumer
 * (a bad row, a DB hiccup) is just as capable of a loop, which is what the consumers'
 * reject-and-DLQ handling now needs somewhere to land.
 */
@Configuration
public class RabbitConfig {

    private static final String EVENTS_EXCHANGE = "dannest.events";
    private static final String NOTIFICATION_QUEUE = "notification.notifications.q";
    private static final String NOTIFICATION_DLQ = "notification.notifications.dlq";
    private static final String ACTIVITY_QUEUE = "notification.activity.q";
    private static final String ACTIVITY_DLQ = "notification.activity.dlq";

    private static final List<String> NOTIFICATION_ROUTING_KEYS =
            Arrays.stream(NotificationType.values()).map(t -> t.routingKey).toList();
    private static final List<String> ACTIVITY_ROUTING_KEYS =
            Arrays.stream(ActivityType.values()).map(t -> t.routingKey).toList();

    @Bean
    TopicExchange eventsExchange() {
        return new TopicExchange(EVENTS_EXCHANGE, true, false);
    }

    @Bean
    Queue notificationDlq() {
        return new Queue(NOTIFICATION_DLQ, true);
    }

    @Bean
    Queue notificationQueue() {
        return QueueBuilder.durable(NOTIFICATION_QUEUE)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", NOTIFICATION_DLQ)
                .build();
    }

    /**
     * {@link Declarables}, not a bare {@code List<Binding>} — {@code RabbitAdmin}'s
     * auto-declaration only picks up {@code Declarable} beans (a plain {@code List} bean
     * would silently never get declared against the broker).
     */
    @Bean
    Declarables notificationBindings(Queue notificationQueue, TopicExchange eventsExchange) {
        List<Binding> bindings = NOTIFICATION_ROUTING_KEYS.stream()
                .map(key -> BindingBuilder.bind(notificationQueue).to(eventsExchange).with(key))
                .toList();
        return new Declarables(bindings);
    }

    @Bean
    Queue activityDlq() {
        return new Queue(ACTIVITY_DLQ, true);
    }

    @Bean
    Queue activityQueue() {
        return QueueBuilder.durable(ACTIVITY_QUEUE)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", ACTIVITY_DLQ)
                .build();
    }

    @Bean
    Declarables activityBindings(Queue activityQueue, TopicExchange eventsExchange) {
        List<Binding> bindings = ACTIVITY_ROUTING_KEYS.stream()
                .map(key -> BindingBuilder.bind(activityQueue).to(eventsExchange).with(key))
                .toList();
        return new Declarables(bindings);
    }

    /**
     * Deserializes strictly by the {@code @RabbitListener} method's parameter type, ignoring
     * the {@code __TypeId__} header Jackson would otherwise expect to match Core's producer
     * class by fully-qualified name — the two services' {@code DannestEvent} are independent
     * copies (see the class javadoc), not required to share an identity.
     */
    @Bean
    MessageConverter messageConverter() {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        converter.setTypePrecedence(TypePrecedence.INFERRED);
        return converter;
    }
}
