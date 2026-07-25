-- Following a collection (to be notified of its new posts), and the notifications
-- themselves (a new post in a followed collection; a reply to your comment).

create table collection_follows (
    id            uuid        primary key default gen_random_uuid(),
    follower_id   uuid        not null references users (id),
    collection_id uuid        not null references collections (id) on delete cascade,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint uq_collection_follow unique (follower_id, collection_id)
);

create index idx_collection_follows_collection on collection_follows (collection_id);

create table notifications (
    id            uuid        primary key default gen_random_uuid(),
    recipient_id  uuid        not null references users (id),
    actor_id      uuid        not null references users (id),
    type          varchar(20) not null,
    collection_id uuid        not null references collections (id) on delete cascade,
    post_id       uuid        not null references posts (id) on delete cascade,
    comment_id    uuid        references comments (id) on delete cascade,
    read_at       timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- Listing a user's notifications, newest first.
create index idx_notifications_recipient on notifications (recipient_id, created_at desc);

-- Unread-count lookups (the bell badge) only ever care about the unread rows.
create index idx_notifications_recipient_unread on notifications (recipient_id) where read_at is null;
