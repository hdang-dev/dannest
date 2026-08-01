package com.dannest.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JavaTypeMapper.TypePrecedence;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Declares this service's queue against Core's {@code dannest.events} exchange (properties
 * must match Core's declaration or RabbitMQ rejects it) and binds it to every event type —
 * a {@code #} wildcard, since this is currently the only consumer and cares about all of them.
 */
@Configuration
public class RabbitConfig {

    private static final String EVENTS_EXCHANGE = "dannest.events";
    private static final String QUEUE = "notification.events";

    @Bean
    TopicExchange eventsExchange() {
        return new TopicExchange(EVENTS_EXCHANGE, true, false);
    }

    @Bean
    Queue notificationQueue() {
        return new Queue(QUEUE, true);
    }

    @Bean
    Binding notificationBinding(Queue notificationQueue, TopicExchange eventsExchange) {
        return BindingBuilder.bind(notificationQueue).to(eventsExchange).with("#");
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
