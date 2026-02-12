-- /supabase/migrations/0001_phase0_foundations.sql
-- Applicant Screening System - Phase 0 Foundations
-- NOTE: Run this in Supabase SQL Editor for your STAGING project first.

begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

do $$ begin
  create type public.user_role as enum ('ADMIN', 'OPS', 'CLIENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_status as enum ('ACTIVE', 'INACTIVE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.seniority_level as enum ('SENIOR', 'MID_LEVEL', 'JUNIOR_ENTRY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recommendation_level as enum ('STRONG_FIT', 'POSSIBLE_FIT', 'NOT_RECOMMENDED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_basis_value as enum ('FULL_TIME', 'PART_TIME', 'FREELANCE', 'HYBRID', 'TEMPORARY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.salary_band as enum (
    'ANY',
    'EUR_11532_16000',
    'EUR_16000_20000',
    'EUR_20000_24000',
    'EUR_24000_30000',
    'EUR_30000_45000',
    'EUR_45000_60000',
    'EUR_60000_80000',
    'EUR_80000_OR_MORE'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audit_event_key as enum (
    'AUTH_LOGIN',
    'AUTH_LOGOUT',
    'AUTH_LOGIN_FAILED',
    'COMPANY_CREATED',
    'COMPANY_UPDATED',
    'JOB_CREATED',
    'JOB_UPDATED',
    'APPLICANT_INGESTED',
    'APPLICANT_STARRED',
    'APPLICANT_UNSTARRED'
  );
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  ref_id text not null,
  name text not null,

  logo_bytes bytea null,
  logo_mime text null,
  constraint companies_logo_size_chk
    check (logo_bytes is null or octet_length(logo_bytes) <= 200000),
  constraint companies_logo_mime_chk
    check (logo_mime is null or logo_mime in ('image/png', 'image/jpeg')),

  description text null,
  industry text null,
  website text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint companies_ref_id_format_chk
    check (ref_id ~ '^[A-Z]{3}[0-9]{3}$')
);

create unique index if not exists companies_ref_id_uq on public.companies (ref_id);
create index if not exists companies_name_trgm_idx on public.companies using gin (name gin_trgm_ops);

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- Jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_ref text null,

  company_id uuid not null references public.companies(id) on delete restrict,

  position_title text not null,
  job_description text not null,
  location text null,

  job_basis public.job_basis_value[] not null default '{}',
  salary_bands public.salary_band[] not null default '{}',
  seniority public.seniority_level not null,

  categories text[] not null default '{}',

  status public.job_status not null default 'ACTIVE',
  inactivated_at timestamptz null,
  inactivated_reason text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_company_id_idx on public.jobs (company_id);
create index if not exists jobs_position_title_trgm_idx on public.jobs using gin (position_title gin_trgm_ops);

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

-- Applications
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,

  external_candidate_id text not null,

  candidate_name text null,
  candidate_email text null,
  candidate_phone text null,
  current_location text null,

  match_score int not null,
  recommendation public.recommendation_level not null,

  received_at timestamptz not null default now(),

  cv_external_url text null,
  cv_external_id text null,

  constraint applications_match_score_chk check (match_score between 0 and 100)
);

create index if not exists applications_job_id_idx on public.applications (job_id);
create index if not exists applications_received_at_idx on public.applications (received_at desc);
create index if not exists applications_candidate_name_trgm_idx on public.applications using gin (candidate_name gin_trgm_ops);
create index if not exists applications_candidate_email_trgm_idx on public.applications using gin (candidate_email gin_trgm_ops);
create index if not exists applications_current_location_trgm_idx on public.applications using gin (current_location gin_trgm_ops);

-- App users (links to auth.users)
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text null,
  role public.user_role not null default 'CLIENT',
  created_at timestamptz not null default now()
);

-- Auto-create app_users row when a Supabase Auth user is created
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.app_users (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

create table if not exists public.company_access (
  user_id uuid not null references public.app_users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table if not exists public.stars (
  company_id uuid not null references public.companies(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  starred_by_user_id uuid null references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (company_id, application_id)
);

create table if not exists public.job_company_views (
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  last_viewed_at timestamptz not null default '1970-01-01T00:00:00Z',
  last_viewed_by_user_id uuid null references public.app_users(id) on delete set null,
  primary key (company_id, job_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_key public.audit_event_key not null,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid null references public.app_users(id) on delete set null,
  company_id uuid null references public.companies(id) on delete set null,
  job_id uuid null references public.jobs(id) on delete set null,
  application_id uuid null references public.applications(id) on delete set null,
  ip_address text null,
  user_agent text null,
  metadata jsonb null
);

create or replace view public.v_applicants_global as
select
  a.*,
  j.company_id,
  j.position_title,
  c.name as company_name,
  c.ref_id as company_ref_id
from public.applications a
join public.jobs j on j.id = a.job_id
join public.companies c on c.id = j.company_id;

-- RLS baseline: enable everywhere
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.app_users enable row level security;
alter table public.company_access enable row level security;
alter table public.stars enable row level security;
alter table public.job_company_views enable row level security;
alter table public.audit_logs enable row level security;

-- Minimal safe policies: let signed-in users read their own role + company access.
-- Everything else stays server-only for now (via service_role in Next.js API routes).
drop policy if exists "app_users_select_own" on public.app_users;
create policy "app_users_select_own"
on public.app_users
for select
to authenticated
using (id = auth.uid());

drop policy if exists "company_access_select_own" on public.company_access;
create policy "company_access_select_own"
on public.company_access
for select
to authenticated
using (user_id = auth.uid());

commit;
