-- V10 declared collection_membership.purchase_id as uuid, assuming it'd hold one of
-- Core's own ids. It doesn't — it holds services/marketplace's membership_purchase id,
-- a MongoDB ObjectId (24 hex chars), not a UUID. Same class of mistake V8 already fixed
-- once for media_id, same fix: widen to text. (V10 already ran in production/dev, so
-- this is a new migration, not an edit to it — migrations are append-only history.)
alter table collection_membership
    alter column purchase_id type varchar(64) using purchase_id::text;
