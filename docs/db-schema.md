# DanNest — Database Schema

The schema for DanNest (social + collections). Source of truth for the fields is
`dannest-project-spec.md`; the tables are created by the Flyway migration
[`service/src/main/resources/db/migration/V1__init.sql`](../service/src/main/resources/db/migration/V1__init.sql)
and mapped by JPA entities under `service/src/main/java/com/dannest/`.

## Base entity

Every entity extends a single `@MappedSuperclass` **`BaseEntity`** — so all tables
share `id` (UUID), `created_at`, and `updated_at`. The timestamps are filled
automatically by Spring Data JPA auditing (`@CreatedDate` / `@LastModifiedDate`).

## ER diagram

```mermaid
erDiagram
    USERS ||--o{ COLLECTIONS : owns
    USERS ||--o{ POSTS : authors
    USERS ||--o{ MEDIA : uploads
    USERS ||--o{ COMMENTS : writes
    USERS ||--o{ POST_LIKES : likes
    USERS |o--o| MEDIA : "avatar"
    COLLECTIONS |o--o| MEDIA : "cover"
    COLLECTIONS ||--o{ POSTS : contains
    POSTS ||--o{ POST_MEDIA : includes
    MEDIA ||--o{ POST_MEDIA : "used in"
    POSTS ||--o{ COMMENTS : has
    COMMENTS ||--o{ COMMENTS : "parent of"
    POSTS ||--o{ POST_LIKES : receives

    USERS {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        uuid avatar_media_id FK "nullable"
        text bio
        timestamptz created_at
        timestamptz updated_at
    }
    COLLECTIONS {
        uuid id PK
        uuid owner_id FK
        string name
        text description
        uuid cover_media_id FK "nullable"
        string visibility "PUBLIC | PRIVATE"
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
    MEDIA {
        uuid id PK
        uuid owner_id FK
        string storage_key
        string url
        string mime_type
        bigint size
        int width
        int height
        timestamptz created_at
        timestamptz updated_at
    }
    POST_MEDIA {
        uuid id PK
        uuid post_id FK
        uuid media_id FK
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
```

## Tables

| Table | Purpose | Notes |
| --- | --- | --- |
| `users` | accounts | `username` + `email` unique; `avatar_media_id` → `media` (nullable) |
| `media` | generic asset | avatars, covers, post images (Cloudflare R2); `owner_id` → `users` |
| `collections` | themed groups | `owner_id` → `users`; `cover_media_id` → `media`; `visibility` PUBLIC/PRIVATE |
| `posts` | a post in a collection | `collection_id`, `author_id` |
| `post_media` | post ↔ image join | own `id`, ordered by `display_order`, unique `(post_id, media_id)` |
| `comments` | replies on a post | `parent_comment_id` (nullable) → nested threads |
| `post_likes` | a user's like | own `id`, unique `(post_id, user_id)` |

## Notes

- **Generic media** — avatars, covers, and post images are all `media` rows.
- **Circular FK** — `users.avatar_media_id ↔ media.owner_id`; `avatar_media_id` is
  nullable and set after the media row exists (the migration adds that FK last).
- **Deletes** — `post_media`, `comments`, `post_likes` cascade when their `post` is deleted.
- **Not yet** (spec *Future Features*): saves/bookmarks, follows, tags, search.
