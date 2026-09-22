package com.dannest.outbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dannest.config.RabbitConfig;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.PageRequest;

@ExtendWith(MockitoExtension.class)
class OutboxPollerTest {

    @Mock
    private OutboxEventRepository repository;

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private OutboxPoller poller;

    private OutboxEvent pendingEvent() {
        return OutboxEvent.builder()
                .aggregateType("MEMBERSHIP_PURCHASE")
                .aggregateId("purchase-1")
                .eventType("core.membership.granted")
                .payload("{}")
                .createdAt(Instant.now())
                .build();
    }

    @Test
    void doesNothingWhenThereAreNoPendingEvents() {
        when(repository.findByPublishedAtIsNullOrderByCreatedAt(any(PageRequest.class))).thenReturn(List.of());

        poller.publishPending();

        verify(rabbitTemplate, never()).send(anyString(), anyString(), any(Message.class));
    }

    @Test
    void publishesEachPendingEventAndMarksItPublished() {
        OutboxEvent event = pendingEvent();
        when(repository.findByPublishedAtIsNullOrderByCreatedAt(any(PageRequest.class))).thenReturn(List.of(event));

        poller.publishPending();

        verify(rabbitTemplate).send(eq(RabbitConfig.EVENTS_EXCHANGE), eq("core.membership.granted"), any(Message.class));
        assertThat(event.getPublishedAt()).isNotNull();
        verify(repository).saveAll(List.of(event));
    }

    @Test
    void recordsTheFailureAndLeavesTheEventUnpublishedIfSendThrows() {
        OutboxEvent event = pendingEvent();
        when(repository.findByPublishedAtIsNullOrderByCreatedAt(any(PageRequest.class))).thenReturn(List.of(event));
        doThrow(new AmqpException("broker down")).when(rabbitTemplate)
                .send(anyString(), anyString(), any(Message.class));

        poller.publishPending();

        assertThat(event.getPublishedAt()).isNull();
        assertThat(event.getAttempts()).isEqualTo(1);
        assertThat(event.getLastError()).isEqualTo("broker down");
    }
}
