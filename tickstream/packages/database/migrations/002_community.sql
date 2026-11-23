create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  video_id   uuid not null references videos(id) on delete cascade,
  author     text not null references users(address),
  body       text not null check (char_length(body) between 1 and 500),
  removed    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_video_idx on comments (video_id, created_at desc);

create table if not exists follows (
  follower   text not null references users(address),
  creator    text not null references users(address),
  created_at timestamptz not null default now(),
  primary key (follower, creator),
  check (follower <> creator)
);
create index if not exists follows_creator_idx on follows (creator);

create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid references videos(id) on delete cascade,
  comment_id  uuid references comments(id) on delete cascade,
  reporter    text not null references users(address),
  reason      text not null,
  details     text not null default '',
  status      text not null default 'open',
  resolution  text,
  resolved_by text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  check ((video_id is not null) <> (comment_id is not null))
);
create index if not exists reports_status_idx on reports (status, created_at desc);
create unique index if not exists reports_one_per_video_idx on reports (reporter, video_id) where video_id is not null;
create unique index if not exists reports_one_per_comment_idx on reports (reporter, comment_id) where comment_id is not null;
