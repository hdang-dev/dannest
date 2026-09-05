package com.dannest.membership.event;

import java.util.UUID;

/**
 * Consumed from services/marketplace (routing key {@code mkt.membership.settle_failed}) —
 * Core already granted this purchase's membership, but marketplace couldn't pay the
 * creator their cut (e.g. they never finished Connect onboarding) and refunded the
 * buyer instead. Core's compensation: revoke the membership it already granted, so a
 * refunded buyer doesn't keep access for free — see
 * {@link com.dannest.membership.MembershipRevokedListener}.
 *
 * <p>{@code purchaseId} is a {@code String} (Mongo ObjectId), not a {@code UUID} — see
 * {@link PurchaseInitiatedEvent}.
 */
public record MembershipSettleFailedEvent(UUID eventId, String purchaseId) {
}
