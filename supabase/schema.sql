-- AI Lead Qualifier — Supabase / Postgres schema
-- Run in the Supabase SQL editor. The n8n workflow inserts rows via the REST API
-- (POST /rest/v1/leads) using the service-role key, which bypasses RLS.

create extension if not exists "pgcrypto";

do $$ begin
  create type lead_tier as enum ('Hot', 'Warm', 'Cold', 'Spam');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum ('new', 'contacted', 'meeting_booked', 'nurturing', 'won', 'lost', 'archived');
exception when duplicate_object then null; end $$;

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- raw intake
  name            text not null check (char_length(name) between 1 and 80),
  email           text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  company         text check (char_length(company) <= 100),
  role            text check (char_length(role) <= 80),
  budget          text not null default 'unsure'
                  check (budget in ('lt1k', '1-5k', '5-15k', '15-50k', '50k+', 'unsure')),
  timeline        text not null default 'exploring'
                  check (timeline in ('asap', 'month', '1-3m', '3-6m', 'exploring')),
  source          text not null default 'website',
  message         text not null check (char_length(message) <= 2000),

  -- AI qualification
  score           smallint not null check (score between 0 and 100),
  tier            lead_tier not null,
  confidence      numeric(3, 2) check (confidence between 0 and 1),
  reasons         jsonb not null default '[]'::jsonb,
  intent_signals  jsonb not null default '[]'::jsonb,
  extracted       jsonb not null default '{}'::jsonb,   -- industry, use_case, tools, volume…

  -- routing + SLA
  route           text not null,                         -- 'AE call' | 'Nurture sequence' | 'Disqualify'
  owner           text,
  reply_subject   text,
  reply_body      text,
  sla_minutes     integer,                               -- 15 Hot · 240 Warm · 1440 Cold · null Spam
  sla_due_at      timestamptz,
  first_reply_at  timestamptz,
  status          lead_status not null default 'new',
  processing_ms   integer
);

-- Response-time KPI: minutes from intake to first human reply
alter table public.leads
  add column if not exists response_minutes numeric
  generated always as (extract(epoch from (first_reply_at - created_at)) / 60) stored;

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_tier_status_idx on public.leads (tier, status);
create index if not exists leads_sla_due_idx on public.leads (sla_due_at) where first_reply_at is null and tier <> 'Spam';
create index if not exists leads_email_idx on public.leads (lower(email));

-- Row Level Security: only authenticated team members can read/update.
alter table public.leads enable row level security;

drop policy if exists "team can read leads" on public.leads;
create policy "team can read leads" on public.leads
  for select to authenticated using (true);

drop policy if exists "team can update leads" on public.leads;
create policy "team can update leads" on public.leads
  for update to authenticated using (true) with check (true);

-- Dashboard view: counts + SLA health per tier
create or replace view public.lead_pipeline_kpis with (security_invoker = true) as
select
  tier,
  count(*)                                                        as leads,
  round(avg(score))                                               as avg_score,
  round(avg(response_minutes)::numeric, 1)                        as avg_response_minutes,
  count(*) filter (where first_reply_at is null and sla_due_at < now()) as sla_breaches_open,
  count(*) filter (where first_reply_at <= sla_due_at)            as replied_within_sla
from public.leads
where created_at > now() - interval '30 days'
group by tier;

-- Open queue the sales team works from (oldest SLA first)
create or replace view public.lead_queue with (security_invoker = true) as
select id, created_at, name, company, role, score, tier, route, owner, sla_due_at,
       greatest(0, extract(epoch from (sla_due_at - now())) / 60)::int as minutes_left
from public.leads
where tier <> 'Spam' and first_reply_at is null and status in ('new', 'nurturing')
order by sla_due_at asc nulls last;
