package com.dannest.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JavaTypeMapper.TypePrecedence;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The exchange domain events are published to (a topic exchange, routed by event type)
 * plus, now that Core also *consumes* — the membership saga's replies from
 * services/marketplace — its own queue and dead-letter queue.
 */
@Configuration
public class RabbitConfig {

    public static final String EVENTS_EXCHANGE = "dannest.events";

    // Queue names: <consumer>.<intent>, ending in .q / .dlq so they never read like a
    // routing key. Routing keys (below): <publisher>.<aggregate>.<past-tense-verb>.
    private static final String SAGA_QUEUE = "core.membership-saga.q";
    private static final String SAGA_DLQ = "core.membership-saga.dlq";
    private static final String PAYOUT_FAILED_QUEUE = "core.membership-payout-failed.q";
    private static final String PAYOUT_FAILED_DLQ = "core.membership-payout-failed.dlq";

    /** Only the one key each of Core's saga listeners understands — never a wildcard. An
     * unhandled routing key hitting a listener that can't parse it is how a previous
     * incident here turned into an infinite redelivery loop (see notification's
     * RabbitConfig javadoc). Two different keys means two different queues, not one queue
     * bound twice — see MembershipRevokedListener's javadoc for why. */
    private static final String MEMBERSHIP_CHARGED_KEY = "marketplace.membership.charged";
    private static final String PAYOUT_FAILED_KEY = "marketplace.membership.payout-failed";

    @Bean
    TopicExchange eventsExchange() {
        return new TopicExchange(EVENTS_EXCHANGE, true, false);
    }

    @Bean
    Queue sagaDlq() {
        return new Queue(SAGA_DLQ, true);
    }

    /** Failed/unparseable deliveries land in {@link #sagaDlq()} instead of being
     * redelivered forever. */
    @Bean
    Queue sagaQueue() {
        return QueueBuilder.durable(SAGA_QUEUE)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", SAGA_DLQ)
                .build();
    }

    @Bean
    Binding sagaBinding(Queue sagaQueue, TopicExchange eventsExchange) {
        return BindingBuilder.bind(sagaQueue).to(eventsExchange).with(MEMBERSHIP_CHARGED_KEY);
    }

    @Bean
    Queue payoutFailedDlq() {
        return new Queue(PAYOUT_FAILED_DLQ, true);
    }

    /** See {@link com.dannest.membership.MembershipRevokedListener}'s javadoc — its own
     * queue/DLQ rather than another binding on {@link #sagaQueue()}, since that
     * queue's listener parses every message strictly as {@code PurchaseInitiatedEvent}. */
    @Bean
    Queue payoutFailedQueue() {
        return QueueBuilder.durable(PAYOUT_FAILED_QUEUE)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", PAYOUT_FAILED_DLQ)
                .build();
    }

    @Bean
    Binding payoutFailedBinding(Queue payoutFailedQueue, TopicExchange eventsExchange) {
        return BindingBuilder.bind(payoutFailedQueue).to(eventsExchange).with(PAYOUT_FAILED_KEY);
    }

    /**
     * Deserializes strictly by the {@code @RabbitListener} method's parameter type, ignoring
     * the {@code __TypeId__} header — services/marketplace is a Node producer, it never sends
     * one. Same reasoning (and same fix) as Notification's converter.
     */
    @Bean
    MessageConverter messageConverter() {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        converter.setTypePrecedence(TypePrecedence.INFERRED);
        return converter;
    }

    @Bean
    RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        return template;
    }
}
