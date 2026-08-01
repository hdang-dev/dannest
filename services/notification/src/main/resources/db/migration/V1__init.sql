-- Notifications, owned entirely by this service. No foreign keys to Core's
-- tables (users/collections/posts/comments) — this is a different database
-- once services are deployed separately, so referential integrity can't be
-- enforced across the boundary. Display data (actor username/avatar,
-- collection name) is denormalized onto the row at write time, from the
-- event Core published — this service never queries Core's database.

create table notifications (
    id                uuid        primary key default gen_random_uuid(),
    recipient_id      uuid        not null,
    actor_id          uuid        not null,
    actor_username    varchar(50) not null,
    actor_avatar_url  text,
    type              varchar(20) not null,
    collection_id     uuid        not null,
    collection_name   varchar(100) not null,
    post_id           uuid        not null,
    comment_id        uuid,
    read_at           timestamptz,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

-- Listing a user's notifications, newest first.
create index idx_notifications_recipient on notifications (recipient_id, created_at desc);

-- Unread-count lookups (the bell badge) only ever care about the unread rows.
create index idx_notifications_recipient_unread on notifications (recipient_id) where read_at is null;
