-- FOLLOW notifications have no associated post — relax the NOT NULL
-- constraint that only made sense back when every notification type
-- pointed at one.
alter table notifications alter column post_id drop not null;
