# DanNest — Database Schema

DanNest is split into two backend services, each owning its **own** database —
see [Lesson 4](../lessons/lesson-4-microservices.md). This doc covers **Core's**
Postgres database (social + collections + media); the notification service's much
smaller Postgres schema is at the bottom.

> Media used to be a third service (`services/media`, MongoDB) — it was folded
> back into Core in [Lesson 7](../lessons/lesson-7-remerging-media.md). Core owns
> the `media` table again (migration
> [`V9__media_back_into_core.sql`](../../services/core/src/main/resources/db/migration/V9__media_back_into_core.sql)).

## Core's database

Source of truth for the fields is `dannest-project-spec.md`; the tables are
created by the Flyway migrations in
[`services/core/src/main/resources/db/migration/`](../../services/core/src/main/resources/db/migration/)
and mapped by JPA entities under `services/core/src/main/java/com/dannest/`.

## Base entity

Every entity extends a single `@MappedSuperclass` **`BaseEntity`** — so all tables
share `id` (UUID), `created_at`, and `updated_at`. The timestamps are filled
automatically by Spring Data JPA auditing (`@CreatedDate` / `@LastModifiedDate`).

## ER diagram

```mermaid
erDiagram
    USERS ||--o{ COLLECTIONS : owns
    USERS ||--o{ POSTS : authors
    USERS ||--o{ COMMENTS : writes
    USERS ||--o{ POST_LIKES : likes
    USERS ||--o{ MEDIA : uploads
    COLLECTIONS ||--o{ POSTS : contains
    POSTS ||--o{ POST_MEDIA : includes
    POSTS ||--o{ COMMENTS : has
    COMMENTS ||--o{ COMMENTS : "parent of"
    POSTS ||--o{ POST_LIKES : receives
    USERS ||--o{ COLLECTION_FOLLOWS : follows
    COLLECTIONS ||--o{ COLLECTION_FOLLOWS : "followed by"

    MEDIA {
        uuid id PK
        uuid owner_id FK
        string source "UPLOAD | EXTERNAL"
        string storage_key "R2 object key, null for EXTERNAL"
        string url "public URL"
        string mime_type
        bigint size
        int width
        int height
        real crop_x "0..1, default 0"
        real crop_y "0..1, default 0"
        real crop_width "0..1, default 1"
        real crop_height "0..1, default 1"
        timestamptz deleted_at "nullable (soft-delete)"
        timestamptz created_at
        timestamptz updated_at
    }
    USERS {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        string avatar_media_id "ref to media.id, nullable, no FK"
        string avatar_media_url "denormalized snapshot, nullable"
        real avatar_crop_x "0..1, default 0"
        real avatar_crop_y "0..1, default 0"
        real avatar_crop_width "0..1, default 1"
        real avatar_crop_height "0..1, default 1"
        text bio
        timestamptz created_at
        timestamptz updated_at
    }
    COLLECTIONS {
        uuid id PK
        uuid owner_id FK
        string name
        text description
        string cover_media_id "ref to media.id, nullable, no FK"
        string cover_url "denormalized snapshot, nullable"
        real cover_crop_x "0..1, default 0"
        real cover_crop_y "0..1, default 0"
        real cover_crop_width "0..1, default 1"
        real cover_crop_height "0..1, default 1"
        string visibility "PUBLIC | PRIVATE"
        timestamptz archived_at "nullable (soft-delete)"
        timestamptz created_at
        timestamptz updated_at
    }
    POSTS {
        uuid id PK
        uuid collection_id FK
        uuid author_id FK
        string title
        text content
        timestamptz created_at
        timestamptz updated_at
    }
    POST_MEDIA {
        uuid id PK
        uuid post_id FK
        string media_id "ref to media.id, no FK"
        string url "denormalized snapshot"
        real crop_x "0..1, default 0"
        real crop_y "0..1, default 0"
        real crop_width "0..1, default 1"
        real crop_height "0..1, default 1"
        int display_order
        timestamptz created_at
        timestamptz updated_at
    }
    COMMENTS {
        uuid id PK
        uuid post_id FK
        uuid author_id FK
        uuid parent_comment_id FK "nullable"
        text content
        timestamptz created_at
        timestamptz updated_at
    }
    POST_LIKES {
        uuid id PK
        uuid post_id FK
        uuid user_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    COLLECTION_FOLLOWS {
        uuid id PK
        uuid follower_id FK
        uuid collection_id FK
        timestamptz created_at
        timestamptz updated_at
    }
```

**The `media` table's history** — it lived here through V6, was dropped by
[V7\_\_media_split.sql](../../services/core/src/main/resources/db/migration/V7__media_split.sql)
when media became its own service (which backfilled every reference into the
denormalized columns above), then recreated by
[V9\_\_media_back_into_core.sql](../../services/core/src/main/resources/db/migration/V9__media_back_into_core.sql)
when that service was folded back in ([Lesson 7](../lessons/lesson-7-remerging-media.md)).
The denormalized `*_url` / `*_crop_*` columns were kept as-is through the re-merge —
see *Image crop* and *Notes* below.

## Tables

| Table | Purpose | Notes |
| --- | --- | --- |
| `media` | an uploaded image (bytes in Cloudflare R2) or external link | `owner_id` → `users`; `source` UPLOAD/EXTERNAL; `storage_key` (R2 key, null for EXTERNAL); `url` + `crop_*`; `deleted_at` (soft-delete) |
| `users` | accounts | `username` + `email` unique; `avatar_media_id` (`varchar(64)`, no FK) + denormalized `avatar_media_url`/crop |
| `collections` | themed groups | `owner_id` → `users`; `cover_media_id` (`varchar(64)`, no FK) + denormalized `cover_url`/crop; `visibility` PUBLIC/PRIVATE; `archived_at` (soft-delete) |
| `posts` | a post in a collection | `collection_id`, `author_id` |
| `post_media` | post ↔ image join | own `id`, ordered by `display_order`, `media_id` (`varchar(64)`, no FK) + denormalized `url`/crop, unique `(post_id, media_id)` |
| `comments` | replies on a post | `parent_comment_id` (nullable) → nested threads |
| `post_likes` | a user's like | own `id`, unique `(post_id, user_id)` |
| `collection_follows` | a user following a collection (to be notified of new posts) | `follower_id` → `users`; `collection_id` → `collections`; unique `(follower_id, collection_id)` |

## Image crop (framing)

Framing is **denormalized onto whichever table references the image** — a
`crop_x/y/width/height` quartet per reference (`avatar_crop_*` on `users`,
`cover_crop_*` on `collections`, unprefixed on `post_media`) — copied once, at
write time, from the crop the media endpoint returned for that asset. Added by
[`V3__archive_and_media_crop.sql`](../../services/core/src/main/resources/db/migration/V3__archive_and_media_crop.sql)
(originally on the `media` table) and moved out to these columns by
[`V7__media_split.sql`](../../services/core/src/main/resources/db/migration/V7__media_split.sql);
kept there when media moved back in.

- `crop_x, crop_y, crop_width, crop_height` — the visible rectangle as fractions
  (0..1) of the original image ([ImageCrop.java](../../services/core/src/main/java/com/dannest/common/ImageCrop.java)).
  This alone is enough to render.
- **Zoom is not persisted.** The cropper UI ([ImageCropper.tsx](../../web/src/components/ImageCropper.tsx),
  built on `react-easy-crop`) tracks zoom client-side only while the user is
  actively dragging/scaling — it's converted to the equivalent crop rectangle
  before being sent to the API ([CropDto.java](../../services/core/src/main/java/com/dannest/common/CropDto.java)
  only has `x, y, width, height`). Re-opening the cropper later starts from
  that rectangle, not a remembered zoom level.
- **Render**: apply via CSS now (`object-position` + scale); the same metadata maps
  directly to an image CDN (e.g. Cloudflare Images) later with no schema change.
- **Re-cropping an already-attached image** is an explicit two-call action from the
  frontend — `PATCH /api/v1/media/{id}` for the new crop, then re-save the owning
  entity (post/profile/collection) with the fresh snapshot. Core never re-resolves
  a crop on its own; see [architecture-flows.md](architecture-flows.md).

## Notes

- **Media references, no FK** — `avatar_media_id`/`cover_media_id`/`post_media.media_id`
  are `varchar(64)` (widened from `uuid` in V8, while media lived in a separate
  service with Mongo ObjectId ids) and carry **no foreign key** to `media`. V9 did
  not re-add one: pre-existing rows point at ObjectIds that no longer resolve, and
  the denormalized snapshot is what actually renders regardless. New media rows get
  Core-generated UUID ids.
- **Denormalized snapshots, not live joins** — the `*_url`/`*_crop_*` columns are
  copied once when the reference is set and never synced afterward. A media
  asset's `url` is treated as effectively immutable once attached; soft-deleting
  the underlying `media` row never touches these columns (see
  [architecture-flows.md](architecture-flows.md)). Reads never join to `media`.
- **Deletes** — `post_media`, `comments`, `post_likes` cascade when their `post` is deleted.
- **Not yet** (spec *Future Features*): saves/bookmarks, tags, search.

## Notification service's database

A separate, much smaller Postgres owned by `services/notification` —
[`services/notification/src/main/resources/db/migration/V1__init.sql`](../../services/notification/src/main/resources/db/migration/V1__init.sql).
One table, **no foreign keys to Core's tables** (different database — Postgres
can't enforce a FK across a network boundary, and this service shouldn't be
querying Core's database anyway):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `recipient_id`, `actor_id` | uuid | reference `users.id` in Core's DB — logical only, no FK |
| `actor_username`, `actor_avatar_url` | text | **denormalized** — copied from the event at write time, not looked up |
| `type` | varchar(20) | `NEW_POST` \| `COMMENT_REPLY` \| `FOLLOW` \| `POST_LIKED` |
| `collection_id`, `collection_name` | uuid, text | `collection_name` denormalized, same reason as actor fields |
| `post_id`, `comment_id` | uuid, nullable | `post_id` nullable since [V2\_\_nullable_post_id.sql](../../services/notification/src/main/resources/db/migration/V2__nullable_post_id.sql) — `FOLLOW` has no post; `comment_id` nullable for anything but a reply |
| `read_at` | timestamptz, nullable | |
| `created_at`, `updated_at` | timestamptz | |

Filled entirely by consuming `DannestEvent` messages off RabbitMQ (see
[Lesson 4](../lessons/lesson-4-microservices.md)) — this service never queries Core's
database to render a notification, which is *why* the denormalized columns
exist instead of just storing IDs.

## Media (in Core)

Media is a Core table again — [`Media.java`](../../services/core/src/main/java/com/dannest/media/Media.java),
created by [`V9__media_back_into_core.sql`](../../services/core/src/main/resources/db/migration/V9__media_back_into_core.sql).
Core owns each image asset's full lifecycle: upload (bytes → Cloudflare R2 via the
S3 SDK), crop-edit, soft-delete. See the `MEDIA` block in the ER diagram above for
columns.

Even though `media` now lives in the same database, reads still don't join to it —
every reference (`users.avatar_media_id`, `collections.cover_media_id`,
`post_media.media_id`) carries a denormalized `url`/crop snapshot captured at write
time. That started as a cross-service necessity (V7) and was kept because it also
keeps feed/profile reads join-free and a soft-deleted asset from breaking an
existing attachment. See the *Image crop* and *Notes* sections above, and the full
read/write flow in [architecture-flows.md](architecture-flows.md).
