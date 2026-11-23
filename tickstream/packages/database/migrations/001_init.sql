create table if not exists users (
  address      text primary key,
  username     text not null unique,
  display_name text,
  bio          text,
  created_at   timestamptz not null default now()
);

create table if not exists videos (
  id               uuid primary key default gen_random_uuid(),
  creator          text not null references users(address),
  title            text not null,
  description      text not null default '',
  category         text not null default 'other',
  price_micro      integer not null check (price_micro between 1 and 100000),
  status           text not null default 'uploading',
  error            text,
  duration_seconds real,
  segment_seconds  integer not null default 2,
  segments         jsonb,
  iv               text,
  key_hex          text,
  source_key       text,
  thumb_key        text,
  views            integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists videos_status_created_idx on videos (status, created_at desc);
create index if not exists videos_creator_idx on videos (creator);

create table if not exists playback_sessions (
  id                  uuid primary key default gen_random_uuid(),
  video_id            uuid not null references videos(id),
  viewer              text not null,
  payer               text not null,
  status              text not null default 'active',
  cap_micro           integer not null,
  chunk_seconds       integer not null,
  segments_authorized integer not null default 0,
  spent_micro         bigint not null default 0,
  started_at          timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  ended_at            timestamptz,
  end_reason          text
);
create index if not exists sessions_viewer_idx on playback_sessions (viewer, started_at desc);
create index if not exists sessions_active_idx on playback_sessions (status, last_seen_at);

create table if not exists payments (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references playback_sessions(id),
  video_id     uuid not null references videos(id),
  creator      text not null,
  payer        text not null,
  amount_micro bigint not null,
  seconds      integer not null,
  network      text not null,
  nonce        text not null unique,
  transfer_id  text,
  status       text not null default 'pending',
  error        text,
  created_at   timestamptz not null default now(),
  settled_at   timestamptz
);
create index if not exists payments_creator_idx on payments (creator, created_at desc);
create index if not exists payments_status_idx on payments (status, created_at);
create index if not exists payments_video_idx on payments (video_id);
