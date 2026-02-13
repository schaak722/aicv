import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

const StatusSchema = z.enum(["ACTIVE", "INACTIVE", "ALL"]);
const SortSchema = z.enum(["updated_at", "created_at", "position_title"]);
const DirSchema = z.enum(["asc", "desc"]);

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

async function getAllowedCompanyIds(admin: ReturnType<typeof createAdminSupabase>, userId: string) {
  const { data: access, error } = await admin.from("company_access").select("company_id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (access ?? []).map((r: any) => r.company_id as string);
}

async function applyAutoInactivation(admin: ReturnType<typeof createAdminSupabase>) {
  // Inactive if unchanged for 60 days (based on updated_at). This avoids re-inactivating manually reactivated jobs.
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  await admin
    .from("jobs")
    .update({
      status: "INACTIVE",
      inactivated_at: new Date().toISOString(),
      inactivated_reason: "AUTO_60_DAYS"
    })
    .eq("status", "ACTIVE")
    .lt("updated_at", cutoff);
}

export async function GET(req: NextRequest) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = StatusSchema.safeParse(url.searchParams.get("status") ?? "ALL").data ?? "ALL";
  const companyId = (url.searchParams.get("companyId") ?? "").trim();
  const sort = SortSchema.safeParse(url.searchParams.get("sort") ?? "updated_at").data ?? "updated_at";
  const dir = DirSchema.safeParse(url.searchParams.get("dir") ?? "desc").data ?? "desc";
  const page = clampInt(url.searchParams.get("page"), 1, 1, 9999);
  const pageSize = clampInt(url.searchParams.get("pageSize"), 25, 5, 100);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = createAdminSupabase();

  // auto-inactivate quietly (best effort)
  try {
    await applyAutoInactivation(admin);
  } catch {
    // ignore
  }

  // CLIENT users can only see jobs for companies assigned via company_access
  let allowedCompanyIds: string[] | null = null;
  if (auth.role === "CLIENT") {
    try {
      allowedCompanyIds = await getAllowedCompanyIds(admin, auth.userId);
      if (allowedCompanyIds.length === 0) return NextResponse.json({ items: [], total: 0, page, pageSize });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? "Failed to load access" }, { status: 500 });
    }
  }

  let query = admin
    .from("jobs")
    .select("id,job_ref,position_title,company_id,location,seniority,status,created_at,updated_at,companies(name,ref_id)", {
      count: "exact"
    });

  if (allowedCompanyIds) query = query.in("company_id", allowedCompanyIds);
  if (companyId) query = query.eq("company_id", companyId);
  if (status !== "ALL") query = query.eq("status", status);

  if (q.length >= 2) {
    const safe = q.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = query.or(`position_title.ilike.%${safe}%,job_ref.ilike.%${safe}%`);
  }

  query = query.order(sort, { ascending: dir === "asc" }).range(from, to);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const items = (data ?? []).map((r: any) => ({
    id: r.id,
    job_ref: r.job_ref ?? null,
    position_title: r.position_title,
    company_id: r.company_id,
    company_name: r.companies?.name ?? "—",
    company_ref_id: r.companies?.ref_id ?? "—",
    location: r.location ?? null,
    seniority: r.seniority,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at
  }));

  return NextResponse.json({ items, total: count ?? items.length, page, pageSize });
}

const JobFormSchema = z.object({
  company_id: z.string().uuid(),
  job_ref: z.string().max(80).optional().nullable(),
  position_title: z.string().min(2).max(180),
  job_description: z.string().min(20).max(12000),
  location: z.string().max(180).optional().nullable(),
  job_basis: z.array(z.enum(["FULL_TIME", "PART_TIME", "FREELANCE", "HYBRID", "TEMPORARY"])).default([]),
  salary_bands: z
    .array(
      z.enum([
        "ANY",
        "EUR_11532_16000",
        "EUR_16000_20000",
        "EUR_20000_24000",
        "EUR_24000_30000",
        "EUR_30000_45000",
        "EUR_45000_60000",
        "EUR_60000_80000",
        "EUR_80000_OR_MORE"
      ])
    )
    .default([]),
  seniority: z.enum(["SENIOR", "MID_LEVEL", "JUNIOR_ENTRY"]),
  categories: z.array(z.string().min(1).max(80)).default([]),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  inactivated_reason: z.string().max(400).optional().nullable()
});

export async function POST(req: NextRequest) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = JobFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const admin = createAdminSupabase();

  const desiredStatus = parsed.data.status ?? "ACTIVE";
  if (desiredStatus === "INACTIVE" && !(parsed.data.inactivated_reason ?? "").trim()) {
    return NextResponse.json({ error: "Inactivation reason is required" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  const insertPayload: any = {
    company_id: parsed.data.company_id,
    job_ref: parsed.data.job_ref ?? null,
    position_title: parsed.data.position_title,
    job_description: parsed.data.job_description,
    location: parsed.data.location ?? null,
    job_basis: parsed.data.job_basis,
    salary_bands: parsed.data.salary_bands,
    seniority: parsed.data.seniority,
    categories: parsed.data.categories,
    status: desiredStatus,
    inactivated_reason: desiredStatus === "INACTIVE" ? (parsed.data.inactivated_reason ?? null) : null,
    inactivated_at: desiredStatus === "INACTIVE" ? nowIso : null
  };

  const { data, error } = await admin.from("jobs").insert(insertPayload).select("id").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to create job" }, { status: 400 });

  return NextResponse.json({ ok: true, job: data });
}
