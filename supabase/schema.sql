-- ackrate research arena — Supabase schema
-- Run once in the Supabase SQL editor before setting DATABASE_URL in Railway.
-- The Express API is the only database client. No browser-facing RLS policies
-- are created, and no secret key, private key, card number, CVV, or Prava
-- one-time credential may be stored in these tables.

create extension if not exists pgcrypto;

create or replace function public.ackrate_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.agents (
  id text primary key,
  name text not null,
  provider text not null check (provider in ('openai', 'anthropic', 'demo')),
  status text not null default 'active' check (status in ('active', 'paused', 'retired')),
  global_elo integer not null default 1000 check (global_elo >= 0),
  arenas_entered integer not null default 0 check (arenas_entered >= 0),
  wins integer not null default 0 check (wins >= 0),
  total_earned numeric(14, 2) not null default 0 check (total_earned >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  network text not null,
  asset text not null,
  public_address text not null,
  label text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network, public_address)
);

comment on table public.wallets is
  'Public settlement addresses only. Never store private keys, seed phrases, card data, CVVs, or Prava one-time credentials.';

create table if not exists public.agent_wallets (
  agent_id text not null references public.agents(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (agent_id, wallet_id)
);

create unique index if not exists agent_wallets_one_primary_idx
  on public.agent_wallets (agent_id)
  where is_primary;

create table if not exists public.arenas (
  id text primary key,
  slug text not null unique,
  buyer_id text,
  buyer_email text not null,
  topic_public text,
  topic_private text,
  topic_visibility text check (topic_visibility in ('public', 'gated')),
  minimum_global_elo integer not null default 0 check (minimum_global_elo >= 0),
  qualified_agent_count integer not null default 0 check (qualified_agent_count >= 0),
  budget numeric(14, 2) not null default 0 check (budget >= 0),
  currency text not null default 'USD',
  status text not null check (status in (
    'funding_required', 'funding_pending', 'funded', 'researching',
    'ready_to_settle', 'complete', 'failed'
  )),
  fingerprint jsonb,
  payload text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arenas_updated_at_idx
  on public.arenas (updated_at desc);

create index if not exists arenas_status_idx
  on public.arenas (status, updated_at desc);

create table if not exists public.arena_criteria (
  arena_id text not null references public.arenas(id) on delete cascade,
  criterion_id text not null,
  label text not null,
  description text not null default '',
  weight numeric(8, 6) not null check (weight > 0 and weight <= 1),
  visibility text not null check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  primary key (arena_id, criterion_id)
);

create table if not exists public.arena_participants (
  arena_id text not null references public.arenas(id) on delete cascade,
  agent_id text not null references public.agents(id),
  qualification_elo integer not null check (qualification_elo >= 0),
  qualified boolean not null default true,
  private_context_disclosed boolean not null default false,
  entered_at timestamptz not null default now(),
  submitted_at timestamptz,
  primary key (arena_id, agent_id)
);

create table if not exists public.arena_submissions (
  id text primary key,
  arena_id text not null references public.arenas(id) on delete cascade,
  agent_id text not null references public.agents(id),
  provider text not null check (provider in ('openai', 'anthropic', 'demo')),
  bid_amount numeric(14, 2) not null check (bid_amount > 0),
  global_elo integer not null check (global_elo >= 0),
  arena_elo integer not null default 1000 check (arena_elo >= 0),
  is_winner boolean not null default false,
  disposition text not null default 'submitted' check (disposition in ('submitted', 'winner', 'discarded')),
  report jsonb,
  finding_count integer not null default 0 check (finding_count >= 0),
  source_count integer not null default 0 check (source_count >= 0),
  submitted_at timestamptz not null default now(),
  discarded_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists arena_submissions_arena_rank_idx
  on public.arena_submissions (arena_id, arena_elo desc);

create index if not exists arena_submissions_agent_idx
  on public.arena_submissions (agent_id, submitted_at desc);

create table if not exists public.arena_evaluations (
  id text primary key,
  arena_id text not null references public.arenas(id) on delete cascade,
  criterion_id text not null,
  left_submission_id text not null references public.arena_submissions(id) on delete cascade,
  right_submission_id text not null references public.arena_submissions(id) on delete cascade,
  winner_submission_id text not null references public.arena_submissions(id) on delete cascade,
  rationale text not null,
  created_at timestamptz not null default now(),
  foreign key (arena_id, criterion_id)
    references public.arena_criteria(arena_id, criterion_id)
    on delete cascade
);

create index if not exists arena_evaluations_arena_idx
  on public.arena_evaluations (arena_id, criterion_id);

create table if not exists public.payments (
  arena_id text primary key references public.arenas(id) on delete cascade,
  mode text not null check (mode in ('prava', 'demo')),
  status text not null check (status in (
    'not_started', 'pending_approval', 'active', 'charging', 'completed', 'failed'
  )),
  authorized_budget numeric(14, 2) not null check (authorized_budget >= 0),
  settlement_amount numeric(14, 2) check (settlement_amount >= 0),
  currency text not null default 'USD',
  session_id text,
  mandate_id text,
  transaction_id text,
  order_id text,
  provider_response_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payments is
  'Provider references and status only. Prava credentials and payment-card data are forbidden.';

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  arena_id text not null references public.arenas(id) on delete cascade,
  submission_id text not null references public.arena_submissions(id) on delete cascade,
  agent_id text not null references public.agents(id),
  wallet_id uuid references public.wallets(id),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  status text not null check (status in ('pending', 'completed', 'failed')),
  prava_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (arena_id, submission_id)
);

create table if not exists public.agent_reputation_events (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents(id),
  arena_id text references public.arenas(id) on delete set null,
  rating_before integer not null check (rating_before >= 0),
  rating_after integer not null check (rating_after >= 0),
  delta integer generated always as (rating_after - rating_before) stored,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists agent_reputation_events_agent_idx
  on public.agent_reputation_events (agent_id, created_at desc);

insert into public.agents (id, name, provider, global_elo)
values
  ('evidence-scout', 'evidence scout', 'openai', 1280),
  ('skeptical-analyst', 'skeptical analyst', 'anthropic', 1220),
  ('decision-architect', 'decision architect', 'openai', 1160)
on conflict (id) do update set
  name = excluded.name,
  provider = excluded.provider,
  global_elo = excluded.global_elo,
  updated_at = now();

drop trigger if exists agents_set_updated_at on public.agents;
create trigger agents_set_updated_at before update on public.agents
for each row execute function public.ackrate_set_updated_at();

drop trigger if exists wallets_set_updated_at on public.wallets;
create trigger wallets_set_updated_at before update on public.wallets
for each row execute function public.ackrate_set_updated_at();

drop trigger if exists arenas_set_updated_at on public.arenas;
create trigger arenas_set_updated_at before update on public.arenas
for each row execute function public.ackrate_set_updated_at();

drop trigger if exists arena_submissions_set_updated_at on public.arena_submissions;
create trigger arena_submissions_set_updated_at before update on public.arena_submissions
for each row execute function public.ackrate_set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.ackrate_set_updated_at();

drop trigger if exists settlements_set_updated_at on public.settlements;
create trigger settlements_set_updated_at before update on public.settlements
for each row execute function public.ackrate_set_updated_at();

-- Supabase exposes the public schema through its Data API. Keep these tables
-- server-only: RLS is enabled and no anon/authenticated policies are created.
alter table public.agents enable row level security;
alter table public.wallets enable row level security;
alter table public.agent_wallets enable row level security;
alter table public.arenas enable row level security;
alter table public.arena_criteria enable row level security;
alter table public.arena_participants enable row level security;
alter table public.arena_submissions enable row level security;
alter table public.arena_evaluations enable row level security;
alter table public.payments enable row level security;
alter table public.settlements enable row level security;
alter table public.agent_reputation_events enable row level security;

revoke all on table public.agents from anon, authenticated;
revoke all on table public.wallets from anon, authenticated;
revoke all on table public.agent_wallets from anon, authenticated;
revoke all on table public.arenas from anon, authenticated;
revoke all on table public.arena_criteria from anon, authenticated;
revoke all on table public.arena_participants from anon, authenticated;
revoke all on table public.arena_submissions from anon, authenticated;
revoke all on table public.arena_evaluations from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.settlements from anon, authenticated;
revoke all on table public.agent_reputation_events from anon, authenticated;

