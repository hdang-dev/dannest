-- Google (OAuth) sign-in support on the users table.

-- OAuth users have no password.
alter table users alter column password_hash drop not null;

-- Link to the external identity provider.
alter table users add column provider    varchar(20);
alter table users add column provider_id varchar(255);
alter table users add column avatar_url  varchar(1024);

-- A given provider identity (e.g. GOOGLE + sub) maps to exactly one user.
alter table users add constraint uq_users_provider unique (provider, provider_id);
