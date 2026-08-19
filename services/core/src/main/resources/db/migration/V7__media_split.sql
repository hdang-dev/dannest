-- Media assets now live in a separate service (services/media, MongoDB + Cloudflare
-- R2) — see docs/tech/architecture-flows.md. Core keeps the opaque media id (no FK)
-- plus a url/crop snapshot captured at write time, so reads never depend on the media
-- service being up. Backfill every existing reference from the old `media` table
-- before dropping it, so nothing already attached (avatar, cover, post image) breaks.

-- ---- users: denormalized "own uploaded avatar" snapshot ----
-- (avatar_url already exists — that's the OAuth provider picture, a different thing.)
alter table users add column avatar_media_url varchar(1024);
alter table users add column avatar_crop_x      real not null default 0;
alter table users add column avatar_crop_y      real not null default 0;
alter table users add column avatar_crop_width  real not null default 1;
alter table users add column avatar_crop_height real not null default 1;

update users u
set avatar_media_url  = m.url,
    avatar_crop_x      = m.crop_x,
    avatar_crop_y      = m.crop_y,
    avatar_crop_width  = m.crop_width,
    avatar_crop_height = m.crop_height
from media m
where u.avatar_media_id = m.id;

alter table users drop constraint fk_users_avatar_media;

-- ---- collections: denormalized cover snapshot ----
alter table collections add column cover_url varchar(1024);
alter table collections add column cover_crop_x      real not null default 0;
alter table collections add column cover_crop_y      real not null default 0;
alter table collections add column cover_crop_width  real not null default 1;
alter table collections add column cover_crop_height real not null default 1;

update collections c
set cover_url        = m.url,
    cover_crop_x      = m.crop_x,
    cover_crop_y      = m.crop_y,
    cover_crop_width  = m.crop_width,
    cover_crop_height = m.crop_height
from media m
where c.cover_media_id = m.id;

alter table collections drop constraint collections_cover_media_id_fkey;

-- ---- post_media: denormalized image url/crop snapshot ----
alter table post_media add column url varchar(1024);
alter table post_media add column crop_x      real not null default 0;
alter table post_media add column crop_y      real not null default 0;
alter table post_media add column crop_width  real not null default 1;
alter table post_media add column crop_height real not null default 1;

update post_media pm
set url        = m.url,
    crop_x      = m.crop_x,
    crop_y      = m.crop_y,
    crop_width  = m.crop_width,
    crop_height = m.crop_height
from media m
where pm.media_id = m.id;

alter table post_media alter column url set not null;
alter table post_media drop constraint post_media_media_id_fkey;

-- The media table's data now lives in services/media's MongoDB — nothing in Core
-- reads or writes it anymore.
drop table media;
