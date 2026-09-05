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

    private static final String MARKETPLACE_QUEUE = "core.marketplace";
    private static final String MARKETPLACE_DLQ = "core.marketplace.dlq";
    private static final String MARKETPLACE_SETTLE_FAILED_QUEUE = "core.marketplace.settle-failed";
    private static final String MARKETPLACE_SETTLE_FAILED_DLQ = "core.marketplace.settle-failed.dlq";

    /** Only the one key each of Core's saga listeners understands — never a wildcard. An
     * unhandled routing key hitting a listener that can't parse it is how a previous
     * incident here turned into an infinite redelivery loop (see notification's
     * RabbitConfig javadoc). Two different keys means two different queues, not one queue
     * bound twice — see MembershipRevokedListener's javadoc for why. */
    private static final String PURCHASE_INITIATED_KEY = "mkt.membership.purchase_initiated";
    private static final String SETTLE_FAILED_KEY = "mkt.membership.settle_failed";

    @Bean
    TopicExchange eventsExchange() {
        return new TopicExchange(EVENTS_EXCHANGE, true, false);
    }

    @Bean
    Queue marketplaceDlq() {
        return new Queue(MARKETPLACE_DLQ, true);
    }

    /** Failed/unparseable deliveries land in {@link #marketplaceDlq()} instead of being
     * redelivered forever. */
    @Bean
    Queue marketplaceQueue() {
        return QueueBuilder.durable(MARKETPLACE_QUEUE)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", MARKETPLACE_DLQ)
                .build();
    }

    @Bean
    Binding marketplaceBinding(Queue marketplaceQueue, TopicExchange eventsExchange) {
        return BindingBuilder.bind(marketplaceQueue).to(eventsExchange).with(PURCHASE_INITIATED_KEY);
    }

    @Bean
    Queue marketplaceSettleFailedDlq() {
        return new Queue(MARKETPLACE_SETTLE_FAILED_DLQ, true);
    }

    /** See {@link com.dannest.membership.MembershipRevokedListener}'s javadoc — its own
     * queue/DLQ rather than another binding on {@link #marketplaceQueue()}, since that
     * queue's listener parses every message strictly as {@code PurchaseInitiatedEvent}. */
    @Bean
    Queue marketplaceSettleFailedQueue() {
        return QueueBuilder.durable(MARKETPLACE_SETTLE_FAILED_QUEUE)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", MARKETPLACE_SETTLE_FAILED_DLQ)
                .build();
    }

    @Bean
    Binding marketplaceSettleFailedBinding(Queue marketplaceSettleFailedQueue, TopicExchange eventsExchange) {
        return BindingBuilder.bind(marketplaceSettleFailedQueue).to(eventsExchange).with(SETTLE_FAILED_KEY);
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
