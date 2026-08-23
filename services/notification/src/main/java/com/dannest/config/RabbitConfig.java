package com.dannest.config;

import java.util.List;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.Queue;
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
 * it understands — the exact scenario a topic exchange is for. The notification queue binds
 * explicitly to the four {@code NotificationType} values (used to bind {@code #} back when
 * it was the only consumer) — explicit, not wildcard, because Core also publishes
 * {@code ACTIVITY_*}-prefixed events now, and {@code EventConsumer} would throw on one of
 * those ({@code NotificationType.valueOf("ACTIVITY_POST_CREATED")}) — which, left unguarded,
 * means Spring AMQP's default requeue-on-exception behavior turns into an infinite redelivery
 * loop. The activity queue binds the other way — only the {@code ACTIVITY_*} keys.
 */
@Configuration
public class RabbitConfig {

    private static final String EVENTS_EXCHANGE = "dannest.events";
    private static final String NOTIFICATION_QUEUE = "notification.events";
    private static final String ACTIVITY_QUEUE = "activity.events";

    private static final List<String> NOTIFICATION_ROUTING_KEYS =
            List.of("NEW_POST", "COMMENT_REPLY", "FOLLOW", "POST_LIKED");
    private static final List<String> ACTIVITY_ROUTING_KEYS = List.of(
            "ACTIVITY_POST_CREATED", "ACTIVITY_COMMENT_CREATED", "ACTIVITY_POST_LIKED", "ACTIVITY_COLLECTION_FOLLOWED");

    @Bean
    TopicExchange eventsExchange() {
        return new TopicExchange(EVENTS_EXCHANGE, true, false);
    }

    @Bean
    Queue notificationQueue() {
        return new Queue(NOTIFICATION_QUEUE, true);
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
    Queue activityQueue() {
        return new Queue(ACTIVITY_QUEUE, true);
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
