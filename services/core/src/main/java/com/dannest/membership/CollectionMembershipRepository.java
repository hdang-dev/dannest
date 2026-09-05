package com.dannest.membership;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CollectionMembershipRepository extends JpaRepository<CollectionMembership, UUID> {

    /** The caller's active membership for a collection, if any — used to gate post visibility. */
    Optional<CollectionMembership> findByUserIdAndCollectionIdAndRevokedAtIsNull(UUID userId, UUID collectionId);

    /** Batched form for {@code toResponses} — one query instead of one per collection in a page. */
    List<CollectionMembership> findByUserIdAndCollectionIdInAndRevokedAtIsNull(UUID userId, List<UUID> collectionIds);

    Optional<CollectionMembership> findByPurchaseId(UUID purchaseId);

    /** Stuck-saga / timeout-revoke sweep target (phase 3): active memberships past expiry. */
    List<CollectionMembership> findByRevokedAtIsNullAndExpiresAtBefore(Instant cutoff);
}
