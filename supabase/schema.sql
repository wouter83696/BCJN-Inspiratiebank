create extension if not exists pgcrypto;

create table if not exists public.bcjn_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.bcjn_state (id, data)
values (
  'bcjn-zomer-2026',
  jsonb_build_object(
    'version', 1,
    'updatedAt', null,
    'colleagueIdeas', '[]'::jsonb,
    'hiddenColleagueIdeaIds', '[]'::jsonb,
    'hiddenInspirationTitles', '[]'::jsonb,
    'customLinks', '[]'::jsonb,
    'pendingLinks', '[]'::jsonb,
    'autoAgendaItems', '[]'::jsonb,
    'hiddenAgendaItemIds', '[]'::jsonb,
    'verifiedAgendaItemIds', '[]'::jsonb
  )
)
on conflict (id) do nothing;

alter table public.bcjn_state enable row level security;

drop policy if exists "BCJN public read state" on public.bcjn_state;
create policy "BCJN public read state"
on public.bcjn_state
for select
using (id = 'bcjn-zomer-2026');

drop policy if exists "BCJN public update state" on public.bcjn_state;
create policy "BCJN public update state"
on public.bcjn_state
for update
using (id = 'bcjn-zomer-2026')
with check (id = 'bcjn-zomer-2026');

drop policy if exists "BCJN public insert state" on public.bcjn_state;
create policy "BCJN public insert state"
on public.bcjn_state
for insert
with check (id = 'bcjn-zomer-2026');
