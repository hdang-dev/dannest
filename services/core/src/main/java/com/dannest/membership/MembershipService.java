package com.dannest.membership;

import com.dannest.collection.Collection;
import com.dannest.collection.CollectionRepository;
import com.dannest.collection.Visibility;
import com.dannest.membership.event.MembershipActivatedEvent;
import com.dannest.membership.event.MembershipRejectedEvent;
import com.dannest.membership.event.PurchaseInitiatedEvent;
import com.dannest.outbox.OutboxWriter;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Core's half of the membership-purchase saga: validate a charge services/marketplace
 * already took, then grant or reject — never the other way around, Core never initiates
 * a charge itself. One membership per purchase, 30 days, no renewal (see the marketplace
 * plan's scope cuts).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MembershipService {

    private static final long MEMBERSHIP_DURATION_DAYS = 30;

    private final CollectionRepository collectionRepository;
    private final CollectionMembershipRepository membershipRepository;
    private final OutboxWriter outboxWriter;

    @Transactional
    public void processPurchase(PurchaseInitiatedEvent event) {
        Optional<Collection> maybeCollection = collectionRepository.findById(event.collectionId());
        String rejectionReason = validate(event, maybeCollection);

        if (rejectionReason != null) {
            outboxWriter.write(
                    "MEMBERSHIP_PURCHASE",
                    event.purchaseId(),
                    "core.membership.rejected",
                    new MembershipRejectedEvent(UUID.randomUUID(), event.purchaseId(), rejectionReason));
            return;
        }

        Collection collection = maybeCollection.orElseThrow(); // validate() already ruled out empty
        Instant now = Instant.now();
        membershipRepository.save(CollectionMembership.builder()
                .userId(event.buyerId())
                .collectionId(event.collectionId())
                .purchaseId(event.purchaseId())
                .grantedAt(now)
                .expiresAt(now.plus(MEMBERSHIP_DURATION_DAYS, ChronoUnit.DAYS))
                .build());

        outboxWriter.write(
                "MEMBERSHIP_PURCHASE",
                event.purchaseId(),
                "core.membership.activated",
                new MembershipActivatedEvent(UUID.randomUUID(), event.purchaseId(), collection.getOwnerId()));
    }

    /**
     * Compensation #2's other half (see {@link MembershipRevokedListener}): marketplace
     * already refunded this buyer because it couldn't pay the creator, so undo the grant
     * this same service made in {@link #processPurchase}. {@code revoke()} is itself
     * idempotent (a no-op once already revoked), so redelivery of this event is safe even
     * without the listener's own inbox claim.
     */
    @Transactional
    public void revokeForSettleFailure(String purchaseId) {
        membershipRepository.findByPurchaseId(purchaseId).ifPresentOrElse(
                membership -> {
                    membership.revoke();
                    membershipRepository.save(membership);
                },
                () -> log.warn("settle_failed for unknown purchase {}, nothing to revoke", purchaseId));
    }

    /** {@code null} = ok to grant; otherwise the reason it's being rejected. */
    private String validate(PurchaseInitiatedEvent event, Optional<Collection> maybeCollection) {
        if (maybeCollection.isEmpty()) {
            return "Collection not found";
        }
        Collection collection = maybeCollection.get();
        if (collection.getVisibility() != Visibility.MEMBERS_ONLY) {
            return "Collection is not members-only";
        }
        if (collection.isArchived()) {
            return "Collection is archived";
        }
        if (collection.getOwnerId().equals(event.buyerId())) {
            return "Owner cannot buy their own collection";
        }
        if (collection.getPriceCents() == null || collection.getPriceCents() != event.priceCents()) {
            return "Price mismatch";
        }
        boolean alreadyMember = membershipRepository
                .findByUserIdAndCollectionIdAndRevokedAtIsNull(event.buyerId(), event.collectionId())
                .filter(m -> m.isActive(Instant.now()))
                .isPresent();
        if (alreadyMember) {
            return "Already an active member";
        }
        return null;
    }
}
