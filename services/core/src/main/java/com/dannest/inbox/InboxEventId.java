package com.dannest.inbox;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/** Composite key for {@link InboxEvent} — (eventId, consumer) must be unique together. */
@EqualsAndHashCode
@NoArgsConstructor
@AllArgsConstructor
public class InboxEventId implements Serializable {

    private UUID eventId;
    private String consumer;

    // Lombok's @EqualsAndHashCode covers correctness; these accessors exist only
    // because @IdClass fields must be readable by the same names as the entity's.
    public UUID getEventId() {
        return eventId;
    }

    public String getConsumer() {
        return consumer;
    }

    @Override
    public String toString() {
        return Objects.toString(eventId) + ":" + consumer;
    }
}
