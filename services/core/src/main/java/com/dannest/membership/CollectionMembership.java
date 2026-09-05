package com.dannest.membership;

import com.dannest.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Grants a user access to a {@code MEMBERS_ONLY} collection's posts. Written by the
 * membership saga listener once services/marketplace confirms payment — Core never
 * initiates one on its own, only validates and (in)validates.
 *
 * <p>{@code purchaseId} is the join key back to marketplace's own {@code
 * membership_purchase} row (a different database — logical reference only, no FK) and
 * doubles as the saga's idempotency key: a unique constraint means processing the same
 * {@code purchase_initiated} event twice can never grant two rows. It's a {@code String}
 * (Mongo ObjectId), not a {@code UUID} — same reasoning as {@code media_id} elsewhere in
 * Core: an opaque id from another service, in that service's own id format.
 */
@Entity
@Table(name = "collection_membership")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollectionMembership extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "collection_id", nullable = false)
    private UUID collectionId;

    @Column(name = "purchase_id", length = 64)
    private String purchaseId;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    public boolean isActive(Instant now) {
        return revokedAt == null && (expiresAt == null || expiresAt.isAfter(now));
    }

    public void revoke() {
        if (revokedAt == null) {
            revokedAt = Instant.now();
        }
    }
}
