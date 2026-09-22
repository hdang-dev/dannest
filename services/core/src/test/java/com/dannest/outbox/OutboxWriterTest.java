package com.dannest.outbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OutboxWriterTest {

    @Mock
    private OutboxEventRepository repository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private OutboxWriter writer;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        writer = new OutboxWriter(repository, objectMapper);
    }

    record Payload(String purchaseId) {
    }

    @Test
    void savesTheEventWithItsPayloadSerializedToJson() {
        writer.write("MEMBERSHIP_PURCHASE", "purchase-1", "core.membership.granted", new Payload("purchase-1"));

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(repository).save(captor.capture());
        OutboxEvent saved = captor.getValue();
        assertThat(saved.getAggregateType()).isEqualTo("MEMBERSHIP_PURCHASE");
        assertThat(saved.getAggregateId()).isEqualTo("purchase-1");
        assertThat(saved.getEventType()).isEqualTo("core.membership.granted");
        assertThat(saved.getPayload()).contains("\"purchaseId\":\"purchase-1\"");
    }

    @Test
    void refusesToSilentlySwallowAnUnserializablePayload() {
        // A self-referencing object can't be turned into JSON — Jackson throws.
        Object[] cyclic = new Object[1];
        cyclic[0] = cyclic;

        assertThatThrownBy(() -> writer.write("X", "1", "some.event", cyclic))
                .isInstanceOf(IllegalStateException.class);
    }
}
