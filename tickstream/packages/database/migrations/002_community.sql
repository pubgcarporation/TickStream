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
