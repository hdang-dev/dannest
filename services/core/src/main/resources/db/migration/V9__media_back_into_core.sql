-- Media assets move back into Core (from services/media, which is being retired).
-- Core owns the `media` table again — upload, crop-edit, and delete all happen
-- here, talking to Cloudflare R2 directly via the S3 SDK, exactly as it did
-- before V7 split it out.
--
-- The denormalized url/crop snapshot columns on users / collections / post_media
-- (added in V7) stay exactly as they are: reads still never touch this table, so
-- no foreign keys are re-added and the *_media_id columns stay varchar(64). New
-- media rows get Core-generated UUID ids (36 chars, fits). Rows that still point
-- at the old service's Mongo ObjectIds keep rendering from their snapshot — they
-- just no longer resolve to a media row, so they can't be re-cropped or deleted
-- (no UI does either to an existing attachment anyway).

create table media (
    id          uuid          primary key default gen_random_uuid(),
    owner_id    uuid          not null references users (id),
    source      varchar(20)   not null default 'UPLOAD',
    storage_key varchar(512),
    url         varchar(1024) not null,
    mime_type   varchar(100),
    size        bigint,
    width       int,
    height      int,
    crop_x      real          not null default 0,
    crop_y      real          not null default 0,
    crop_width  real          not null default 1,
    crop_height real          not null default 1,
    deleted_at  timestamptz,
    created_at  timestamptz   not null default now(),
    updated_at  timestamptz   not null default now()
);

create index idx_media_owner on media (owner_id);
