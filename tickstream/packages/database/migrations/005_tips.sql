-- Tips are payments to a creator that are not tied to a viewing session.
-- They share the payments table so settlement, earnings and analytics treat them like any other payment.
alter table payments alter column session_id drop not null;
alter table payments add column if not exists kind text not null default 'watch';
alter table payments add column if not exists message text;
