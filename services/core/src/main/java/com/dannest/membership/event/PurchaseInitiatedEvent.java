package com.dannest.membership.event;

import java.util.UUID;

/**
 * Consumed from services/marketplace (routing key {@code mkt.membership.purchase_initiated}) —
 * the buyer has been charged, marketplace is asking Core to confirm and grant access.
 * {@code priceCents} is re-validated here against the collection's own price; marketplace's
 * copy is only what it charged, never trusted as the source of truth for whether that
 * charge was actually correct.
 *
 * <p>{@code purchaseId} is a {@code String}, not a {@code UUID} — it's a MongoDB
 * ObjectId (marketplace's document id), a different format Core can't assume matches
 * its own UUID convention. Same reasoning as {@code media_id} on posts/collections/users.
 */
public record PurchaseInitiatedEvent(
        UUID eventId, String purchaseId, UUID buyerId, UUID collectionId, int priceCents) {
}
