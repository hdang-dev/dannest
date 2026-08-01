-- Collections: soft-delete (archive) support.
-- archived_at is null for active collections; set = archived (hidden but restorable).
alter table collections
    add column archived_at timestamptz;

-- Listings only ever fetch active rows, so a partial index keeps that path fast.
create index idx_collections_owner_active
    on collections (owner_id)
    where archived_at is null;

-- Media: can now be an EXTERNAL link (no bytes stored) as well as an UPLOAD, and
-- carries a display crop (fractions 0..1 of the image) applied with CSS at render.
alter table media
    add column source varchar(20) not null default 'UPLOAD';

-- EXTERNAL media has no storage key.
alter table media
    alter column storage_key drop not null;

alter table media add column crop_x      real not null default 0;
alter table media add column crop_y      real not null default 0;
alter table media add column crop_width  real not null default 1;
alter table media add column crop_height real not null default 1;
