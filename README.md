# Applicant Screening Frontend (Phase 0)

This is the Phase 0 scaffold:
- Supabase Auth (invite-only)
- Supabase Postgres schema migration
- Next.js Skydash-inspired admin UI scaffold
- Admin-only API route to create users (invite)

## 1) Configure environment variables

Create `.env.local` (for local dev) or set env vars in Koyeb:

Required:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server-only, never expose to browser)

Optional:
- APP_NAME

Use `.env.example` as reference.

## 2) Create Supabase project (STAGING)

Run the SQL migration:
`supabase/migrations/0001_phase0_foundations.sql`

## 3) Bootstrap the first ADMIN

In Supabase Dashboard:
1) Create a user in Auth (email + password)
2) Copy the user's UUID (Auth -> Users)
3) Run:

```sql
insert into public.app_users (id, role, display_name)
values ('<USER_UUID>', 'ADMIN', 'First Admin')
on conflict (id) do update set role = excluded.role, display_name = excluded.display_name;
```

## 4) Run locally

```bash
npm ci
npm run dev
```

Open http://localhost:3000

## 5) Deploy on Koyeb

- Build command: `npm ci && npm run build`
- Run command: `npm run start`
- Set env vars in Koyeb (same as above)

## Admin features in Phase 0
- Create users (invite-only) and optionally assign Company Access by Ref ID.
- Reset passwords (Admin-only, MVP rule).
