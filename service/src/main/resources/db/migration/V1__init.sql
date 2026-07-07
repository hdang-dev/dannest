-- DanNest initial schema.
-- gen_random_uuid() is built into PostgreSQL 13+ (no extension needed).
-- created_at / updated_at have defaults so raw SQL inserts work; the app fills
-- them via JPA auditing.

-- ============================ users ============================
-- avatar_media_id FK is added AFTER media exists (users <-> media is circular).
create table users (
    id            uuid         primary key default gen_random_uuid(),
    username      varchar(50)  not null unique,
    email         varchar(255) not null unique,
    password_hash varchar(255) not null,
    avatar_media_id uuid,
    bio           text,
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz  not null default now()
);

-- ============================ media ============================
create table media (
    id          uuid          primary key default gen_random_uuid(),
    owner_id    uuid          not null references users (id),
    storage_key varchar(512)  not null,
    url         varchar(1024) not null,
    mime_type   varchar(100),
    size        bigint,
    width       int,
    height      int,
    created_at  timestamptz   not null default now(),
    updated_at  timestamptz   not null default now()
);

alter table users
    add constraint fk_users_avatar_media foreign key (avatar_media_id) references media (id);

-- ========================= collections =========================
create table collections (
    id             uuid         primary key default gen_random_uuid(),
    owner_id       uuid         not null references users (id),
    name           varchar(120) not null,
    description    text,
    cover_media_id uuid         references media (id),
    visibility     varchar(20)  not null,
    created_at     timestamptz  not null default now(),
    updated_at     timestamptz  not null default now()
);

-- ============================ posts ============================
create table posts (
    id            uuid         primary key default gen_random_uuid(),
    collection_id uuid         not null references collections (id),
    author_id     uuid         not null references users (id),
    title         varchar(200) not null,
    content       text,
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz  not null default now()
);

-- ========================= post_media =========================
create table post_media (
    id            uuid        primary key default gen_random_uuid(),
    post_id       uuid        not null references posts (id) on delete cascade,
    media_id      uuid        not null references media (id),
    display_order int         not null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint uq_post_media unique (post_id, media_id)
);

-- ========================== comments ==========================
create table comments (
    id                uuid        primary key default gen_random_uuid(),
    post_id           uuid        not null references posts (id) on delete cascade,
    author_id         uuid        not null references users (id),
    parent_comment_id uuid        references comments (id) on delete cascade,
    content           text        not null,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

-- ========================= post_likes =========================
create table post_likes (
    id         uuid        primary key default gen_random_uuid(),
    post_id    uuid        not null references posts (id) on delete cascade,
    user_id    uuid        not null references users (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_post_like unique (post_id, user_id)
);

-- ============================ indexes ============================
create index idx_media_owner          on media (owner_id);
create index idx_collections_owner    on collections (owner_id);
create index idx_posts_collection     on posts (collection_id);
create index idx_posts_author         on posts (author_id);
create index idx_post_media_post      on post_media (post_id);
create index idx_comments_post        on comments (post_id);
create index idx_comments_parent      on comments (parent_comment_id);
create index idx_post_likes_post      on post_likes (post_id);
create index idx_post_likes_user      on post_likes (user_id);
