-- ============================================================
-- 마음아 놀자 (maum.chatgpts.kr) Supabase 데이터베이스 스키마
-- ============================================================

-- 1. 마음 데일리 성찰 일기
create table if not exists public.maum_daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mood text not null,               -- 'peace', 'anxious', 'angry', 'sad', 'grateful', 'tired', 'joy'
  note text,                        -- 한 줄 성찰 메모
  gratitude text,                   -- 오늘 감사한 것
  let_go text,                      -- 오늘 내려놓을 것
  created_at timestamptz not null default now()
);

-- 2. 즐겨찾기 보관함
create table if not exists public.maum_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null,       -- 'daily', 'wisdom', 'card'
  content_key text not null,        -- 예: 'daily-001', 'wis-005', 'card-012'
  title text not null,
  text text not null,
  category text,
  created_at timestamptz not null default now(),
  constraint maum_fav_unique unique (user_id, content_type, content_key)
);

-- 3. 호흡 명상 세션 완료 기록
create table if not exists public.maum_meditation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  duration_seconds integer not null default 60,
  technique text default 'box',     -- 'box', 'calm', 'deep'
  completed boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4. 마음 카드 뽑기 기록
create table if not exists public.maum_card_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_key text not null,
  theme text not null,
  title text,
  text text,
  created_at timestamptz not null default now()
);

-- 인덱스 생성
create index if not exists idx_maum_daily_logs_user on public.maum_daily_logs(user_id, created_at desc);
create index if not exists idx_maum_favorites_user on public.maum_favorites(user_id, created_at desc);
create index if not exists idx_maum_meditation_logs_user on public.maum_meditation_logs(user_id, created_at desc);
create index if not exists idx_maum_card_logs_user on public.maum_card_logs(user_id, created_at desc);

-- ============================================================
-- RLS (Row Level Security) 설정
-- ============================================================
alter table public.maum_daily_logs enable row level security;
alter table public.maum_favorites enable row level security;
alter table public.maum_meditation_logs enable row level security;
alter table public.maum_card_logs enable row level security;

-- 본인 소유 데이터 정책 (CRUD)
create policy "Users manage own maum daily logs"
  on public.maum_daily_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own maum favorites"
  on public.maum_favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own maum meditation logs"
  on public.maum_meditation_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own maum card logs"
  on public.maum_card_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 관리자(profiles.role = 'admin') 통계 조회 정책
create policy "Admin can read all maum daily logs"
  on public.maum_daily_logs for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin can read all maum meditation logs"
  on public.maum_meditation_logs for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin can read all maum card logs"
  on public.maum_card_logs for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
