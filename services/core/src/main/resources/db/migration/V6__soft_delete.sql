-- Posts, comments, and media: soft-delete support, mirroring collections'
-- archived_at (V3). deleted_at is null for active rows; set = soft-deleted
-- (hidden but recoverable) instead of a hard row delete.

alter table posts add column deleted_at timestamptz;
alter table comments add column deleted_at timestamptz;
alter table media add column deleted_at timestamptz;

-- Posts are listed by collection or by author; both paths filter to active rows.
create index idx_posts_collection_active on posts (collection_id) where deleted_at is null;
create index idx_posts_author_active on posts (author_id) where deleted_at is null;

-- Comments are listed by post; that path filters to active rows.
create index idx_comments_post_active on comments (post_id) where deleted_at is null;
