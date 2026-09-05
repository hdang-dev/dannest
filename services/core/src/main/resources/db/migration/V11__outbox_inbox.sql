-- Transactional outbox + idempotent-consumer inbox, for the membership saga
-- (services/marketplace publishes/consumes the mirror of this over MongoDB).
--
-- outbox_event: written in the SAME transaction as the business row it describes.
-- A background poller (OutboxPoller) publishes rows where published_at is still
-- null, then marks them sent — so an event is never lost even if RabbitMQ is
-- unreachable at the moment the business transaction commits.
create table outbox_event (
    id             uuid         primary key default gen_random_uuid(),
    aggregate_type varchar(20)  not null,
    -- varchar, not uuid — the aggregate this event describes may be identified in
    -- another service's id format (a marketplace purchase id is a Mongo ObjectId,
    -- same reasoning as media_id elsewhere in Core).
    aggregate_id   varchar(64)  not null,
    event_type     varchar(64)  not null,
    -- Already-serialized JSON, published verbatim. Plain text, not jsonb — nothing
    -- ever queries *inside* this column, so there's no reason to ask Postgres to
    -- parse it structurally.
    payload        text         not null,
    created_at     timestamptz  not null default now(),
    published_at   timestamptz,
    attempts       int          not null default 0,
    last_error     text
);

-- The poller's only query shape: "unpublished rows, oldest first". A single instance
-- (see docs/lessons — Notification runs single-instance by design; Core does too)
-- means no SKIP LOCKED / claim-row dance is needed, just this index.
create index idx_outbox_event_unpublished on outbox_event (created_at) where published_at is null;

-- One row per (event, consumer) — "have I already processed this exact event".
-- Insert-or-skip (ON CONFLICT DO NOTHING) is how a listener guards against RabbitMQ's
-- at-least-once redelivery turning into a duplicate membership grant.
create table inbox_event (
    event_id    uuid        not null,
    consumer    varchar(40) not null,
    received_at timestamptz not null default now(),
    primary key (event_id, consumer)
);
