package com.dannest.collection;

public enum Visibility {
    PUBLIC,
    PRIVATE,
    /**
     * Purchasable — listed publicly (so buyers can find it) but its posts require an
     * active {@link com.dannest.membership.CollectionMembership}, granted by the
     * marketplace service's membership saga. Carries a {@code priceCents}. Chosen at
     * creation and never changed afterward (see {@link CollectionService#update}) — a
     * membership purchase would otherwise become worthless (flip to PUBLIC) or lock a
     * paying buyer out (flip to PRIVATE).
     */
    MEMBERS_ONLY,
}
