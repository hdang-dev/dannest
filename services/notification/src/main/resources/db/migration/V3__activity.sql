-- The caller's own activity ("what I did"), as opposed to notifications ("what was
-- done to me") — a separate table, fed by a separate RabbitMQ queue bound to the
-- ACTIVITY_* routing keys (see config/RabbitConfig). No actor_username/actor_avatar_url
-- columns here, unlike notifications — every row already belongs to exactly the user
-- who did the thing, so there's nothing to denormalize for display.

create table activities (
    id                uuid        primary key default gen_random_uuid(),
    actor_id          uuid        not null,
    type              varchar(30) not null,
    collection_id     uuid        not null,
    collection_name   varchar(100) not null,
    post_id           uuid,
    comment_id        uuid,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

-- Listing a user's own activity, newest first.
create index idx_activities_actor on activities (actor_id, created_at desc);
