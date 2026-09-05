package com.dannest.membership.event;

import java.util.UUID;

/**
 * Published to services/marketplace (routing key {@code core.membership.activated}) once
 * the membership is granted. Carries {@code ownerId} so marketplace can transfer the
 * creator's cut without a lookup of its own — Core already had the collection loaded to
 * validate the purchase. {@code purchaseId} is a String (Mongo ObjectId) — see
 * {@link PurchaseInitiatedEvent}.
 */
public record MembershipActivatedEvent(UUID eventId, String purchaseId, UUID ownerId) {
}
