-- 찾아봇 1차 DB 스키마
-- Supabase SQL Editor에서 실행한다.
-- 참가자 명단 매칭, 대화 보관함, 사용량 카운팅은 이후 테이블을 이어서 추가한다.

create table if not exists public.app_users (
  id text primary key,
  identity_hash text not null unique,
  phone_hash text not null,
  phone_last4 text not null,
  phone_masked text not null,
  display_name text not null,
  subject text not null check (subject in ('general', 'participant', 'staff')),
  user_type text not null,
  matched boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists app_users_subject_idx on public.app_users (subject);
create index if not exists app_users_user_type_idx on public.app_users (user_type);
create index if not exists app_users_phone_last4_idx on public.app_users (phone_last4);

alter table public.app_users enable row level security;

-- 현재 앱은 Vercel 서버 함수에서 service role key로만 app_users에 접근한다.
-- 따라서 anon/public RLS 정책은 만들지 않는다.
