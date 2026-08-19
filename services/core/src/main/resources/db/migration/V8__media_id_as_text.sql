-- services/media's ids are Mongo ObjectIds (24 hex chars), not UUIDs. V7 dropped
-- the FK constraints on these columns but left their type as `uuid`, which silently
-- rejects any ObjectId — Postgres never validated a UUID-shaped value at the app
-- layer, but the column type itself still enforces the format. Widen to text.

alter table users
    alter column avatar_media_id type varchar(64) using avatar_media_id::text;

alter table collections
    alter column cover_media_id type varchar(64) using cover_media_id::text;

alter table post_media
    alter column media_id type varchar(64) using media_id::text;
