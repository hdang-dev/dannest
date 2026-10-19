package com.dannest.outbox;

/** Signal that a transaction wrote an outbox row — see {@link OutboxRelayTrigger}. */
public record OutboxEventWritten() {}
