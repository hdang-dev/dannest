package com.dannest.membership.event;

import java.util.UUID;

/**
 * Published to services/marketplace (routing key {@code core.membership.rejected}) when the
 * purchase can't be granted — marketplace's compensation (refund the buyer) hangs off this.
 * {@code purchaseId} is a String (Mongo ObjectId) — see {@link PurchaseInitiatedEvent}.
 */
public record MembershipRejectedEvent(UUID eventId, String purchaseId, String reason) {
}
