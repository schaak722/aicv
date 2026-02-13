-- /supabase/migrations/0002_phase1_companies_logo_rpc.sql
-- Applicant Screening System - Phase 1 (Companies) helpers
-- Purpose: allow safe upload/download of company logos (bytea) via RPC using base64.
-- Run this in Supabase SQL Editor for your project.

begin;

-- Store logo bytes from base64
create or replace function public.set_company_logo(
  p_company_id uuid,
  p_logo_base64 text,
  p_logo_mime text
) returns void
language plpgsql
security definer
as $$
begin
  update public.companies
    set logo_bytes = decode(p_logo_base64, 'base64'),
        logo_mime  = p_logo_mime,
        updated_at = now()
  where id = p_company_id;
end;
$$;

-- Clear logo
create or replace function public.clear_company_logo(
  p_company_id uuid
) returns void
language plpgsql
security definer
as $$
begin
  update public.companies
    set logo_bytes = null,
        logo_mime  = null,
        updated_at = now()
  where id = p_company_id;
end;
$$;

-- Fetch logo as base64 + mime
create or replace function public.get_company_logo(
  p_company_id uuid
) returns table (
  logo_base64 text,
  logo_mime text
)
language sql
stable
security definer
as $$
  select
    case when logo_bytes is null then null else encode(logo_bytes, 'base64') end as logo_base64,
    logo_mime
  from public.companies
  where id = p_company_id
  limit 1;
$$;

commit;
