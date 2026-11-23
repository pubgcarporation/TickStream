alter table videos add column if not exists preview_seconds integer not null default 0 check (preview_seconds between 0 and 60);
alter table playback_sessions add column if not exists last_position integer not null default 0;
