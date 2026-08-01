-- Notifications now live entirely in the notification service's own
-- database (services/notification), filled from the events Core publishes
-- to RabbitMQ. Core never reads or writes this table anymore — drop it.

drop table notifications;
