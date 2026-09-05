-- Members-only collections: a third Visibility alongside PUBLIC/PRIVATE. Purchasable via
-- the marketplace service's membership saga (services/marketplace) — Core only knows the
-- price and who's been granted access, never anything about Stripe or money.
--
-- price_cents is required exactly when visibility = MEMBERS_ONLY (app layer additionally
-- makes both the visibility and the price immutable once set — see CollectionService.update,
-- not enforceable as a DB constraint since it's a transition rule, not a static shape).
alter table collections add column price_cents integer;
alter table collections add constraint chk_collections_members_only_price check (
    (visibility <> 'MEMBERS_ONLY' and price_cents is null)
    or (visibility = 'MEMBERS_ONLY' and price_cents > 0)
);

-- A granted purchase. purchase_id is the join key back to marketplace's
-- membership_purchase row (a different database — logical reference only, no FK).
-- Written by the saga listener (services/core's future membership package); this
-- migration only creates the shape so the visibility-gating read path has something
-- to query starting now, ahead of the saga itself.
create table collection_membership (
    id           uuid        primary key default gen_random_uuid(),
    user_id      uuid        not null references users (id),
    collection_id uuid       not null references collections (id),
    purchase_id  uuid,
    granted_at   timestamptz not null default now(),
    expires_at   timestamptz,
    revoked_at   timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    constraint uq_collection_membership_purchase unique (purchase_id)
);

create index idx_collection_membership_user       on collection_membership (user_id);
create index idx_collection_membership_collection on collection_membership (collection_id);

-- At most one *active* membership per (user, collection) — a re-purchase after
-- expiry/revocation is fine, concurrent duplicates are not.
create unique index uq_collection_membership_active
    on collection_membership (user_id, collection_id)
    where revoked_at is null;
