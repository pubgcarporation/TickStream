-- Trending and per-video earnings read payments by video and time.
create index if not exists payments_video_time_idx on payments (video_id, created_at desc);
-- Reconciliation walks pending payments that already have a Gateway transfer.
create index if not exists payments_pending_idx on payments (id) where status = 'pending' and transfer_id is not null;
