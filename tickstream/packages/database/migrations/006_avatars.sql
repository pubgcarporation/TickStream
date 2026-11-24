-- Profile pictures. The image itself lives in storage; these columns say whether one exists and when it changed.
alter table users add column if not exists avatar_key text;
alter table users add column if not exists avatar_updated_at timestamptz;
