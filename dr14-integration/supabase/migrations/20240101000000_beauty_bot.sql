-- Beauty Bot: post history + Threads token storage

-- 發文記錄
create table if not exists public.beauty_post_history (
  id              bigserial primary key,
  title           text not null default '',
  topic           text not null default '',
  threads_post_id text,
  success         boolean not null default false,
  error_message   text,
  published_at    timestamptz not null default now()
);

alter table public.beauty_post_history enable row level security;

-- 允許 service role 全權操作（Edge Function 使用 service key）
create policy "service_role_all" on public.beauty_post_history
  for all to service_role using (true) with check (true);

-- Threads token 安全儲存（只存最新一筆即可，插入新的舊的自動不用）
create table if not exists public.threads_secrets (
  id          bigserial primary key,
  access_token text not null,
  user_id     text not null,
  username    text not null default '',
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.threads_secrets enable row level security;

-- 只允許 service role 存取（前端絕不直接讀 token）
create policy "service_role_all" on public.threads_secrets
  for all to service_role using (true) with check (true);

-- Index for date-range quota queries
create index if not exists idx_beauty_post_history_published_at
  on public.beauty_post_history (published_at desc);
