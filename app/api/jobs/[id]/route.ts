import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

const ParamsSchema = z.object({ id: z.string().uuid() });

async function getAllowedCompanyIds(admin: ReturnType<typeof createAdminSupabase>, userId: string) {
  const { data: access, error } = await admin.from("company_access").select("company_id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (access ?? []).map((r: any) => r.company_id as string);
}

const UpdateSchema = z.object({
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

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rawParams = await ctx.params;
  const parsedParams = ParamsSchema.safeParse(rawParams);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const admin = createAdminSupabase();

  // CLIENT users can only access jobs for assigned companies
  let allowedCompanyIds: string[] | null = null;
  if (auth.role === "CLIENT") {
    try {
      allowedCompanyIds = await getAllowedCompanyIds(admin, auth.userId);
      if (allowedCompanyIds.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? "Failed to load access" }, { status: 500 });
    }
  }

  let query = admin
    .from("jobs")
    .select(
      "id,job_ref,company_id,position_title,job_description,location,job_basis,salary_bands,seniority,categories,status,inactivated_reason,inactivated_at,created_at,updated_at,companies(name,ref_id)"
    )
    .eq("id", parsedParams.data.id);

  if (allowedCompanyIds) query = query.in("company_id", allowedCompanyIds);

  const { data, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const job: any = {
    id: data.id,
    job_ref: data.job_ref ?? null,
    company_id: data.company_id,
    company_name: (data.companies?.[0]?.name ?? "—"),
    company_ref_id: (data.companies?.[0]?.ref_id ?? "—"),
    position_title: data.position_title,
    job_description: data.job_description,
    location: data.location ?? null,
    job_basis: data.job_basis ?? [],
    salary_bands: data.salary_bands ?? [],
    seniority: data.seniority,
    categories: data.categories ?? [],
    status: data.status,
    inactivated_reason: data.inactivated_reason ?? null,
    inactivated_at: data.inactivated_at ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at
  };

  return NextResponse.json({ job });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rawParams = await ctx.params;
  const parsedParams = ParamsSchema.safeParse(rawParams);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const admin = createAdminSupabase();

  const desiredStatus = parsed.data.status ?? "ACTIVE";
  const nowIso = new Date().toISOString();

  const updatePayload: any = {
    company_id: parsed.data.company_id,
    job_ref: parsed.data.job_ref ?? null,
    position_title: parsed.data.position_title,
    job_description: parsed.data.job_description,
    location: parsed.data.location ?? null,
    job_basis: parsed.data.job_basis,
    salary_bands: parsed.data.salary_bands,
    seniority: parsed.data.seniority,
    categories: parsed.data.categories,
    status: desiredStatus
  };

  if (desiredStatus === "INACTIVE") {
    const reason = (parsed.data.inactivated_reason ?? "").trim();
    if (!reason) return NextResponse.json({ error: "Inactivation reason is required" }, { status: 400 });

    updatePayload.inactivated_reason = reason;
    updatePayload.inactivated_at = nowIso;
  } else {
    updatePayload.inactivated_reason = null;
    updatePayload.inactivated_at = null;
  }

  const { data, error } = await admin.from("jobs").update(updatePayload).eq("id", parsedParams.data.id).select("id").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to update job" }, { status: 400 });

  return NextResponse.json({ ok: true, job: data });
}
