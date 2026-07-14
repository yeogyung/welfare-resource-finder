-- 찾아봇 1차 DB 스키마
-- Supabase SQL Editor에서 실행한다.
-- 참가자 명단 매칭, 대화 보관함, 사용량/클릭 카운팅까지 포함한다.

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

alter table public.app_users add column if not exists participant_id text;
alter table public.app_users add column if not exists group_id text;
alter table public.app_users add column if not exists session_id text;

alter table public.app_users enable row level security;

create table if not exists public.participants (
  id text primary key,
  display_name text not null,
  phone_last4 text,
  phone_masked text,
  group_id text not null default 'gwangjin-senior-education',
  session_id text not null default 'round-1-2026-07-13',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participants_active_sort_idx on public.participants (active, sort_order);
create index if not exists participants_group_session_idx on public.participants (group_id, session_id);

alter table public.participants enable row level security;

create table if not exists public.conversations (
  id text primary key,
  user_id text not null,
  user_type text,
  subject text,
  title text not null default '새 대화',
  mode text not null default 'chat',
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx on public.conversations (user_id, updated_at desc);

alter table public.conversations enable row level security;

create table if not exists public.messages (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  content_kind text not null default 'text',
  mode text not null default 'chat',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists messages_user_created_idx on public.messages (user_id, created_at desc);

alter table public.messages enable row level security;

create table if not exists public.usage_events (
  id text primary key,
  user_id text,
  feature text not null,
  provider text not null default 'openai',
  model text,
  input_tokens integer,
  output_tokens integer,
  request_count integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_created_idx on public.usage_events (user_id, created_at desc);
create index if not exists usage_events_feature_created_idx on public.usage_events (feature, created_at desc);

alter table public.usage_events enable row level security;

-- 현재 앱은 Vercel 서버 함수에서 Secret key/service role key로만 DB에 접근한다.
-- 따라서 anon/public RLS 정책은 만들지 않는다.
