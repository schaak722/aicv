import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

const SortSchema = z.enum(["name", "ref_id", "created_at"]);
const DirSchema = z.enum(["asc", "desc"]);
const StatusSchema = z.enum(["ALL", "ACTIVE", "INACTIVE"]);

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function escapeILike(q: string) {
  return q.replaceAll("%", "\\%").replaceAll("_", "\\_");
}

async function getAllowedCompanyIds(admin: ReturnType<typeof createAdminSupabase>, userId: string) {
  const { data: access, error: accessErr } = await admin.from("company_access").select("company_id").eq("user_id", userId);
  if (accessErr) throw new Error(accessErr.message);
  return (access ?? []).map((r: any) => r.company_id as string);
}

async function getActiveCompanyIdSet(admin: ReturnType<typeof createAdminSupabase>, companyIds: string[]) {
  if (companyIds.length === 0) return new Set<string>();
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("jobs")
    .select("company_id")
    .eq("status", "ACTIVE")
    .gte("updated_at", cutoff)
    .in("company_id", companyIds);

  if (error) throw new Error(error.message);

  const set = new Set<string>();
  for (const r of data ?? []) {
    if (r && (r as any).company_id) set.add((r as any).company_id as string);
  }
  return set;
}

export async function GET(req: NextRequest) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);

  const q = (url.searchParams.get("q") ?? "").trim();
  const sort = SortSchema.safeParse(url.searchParams.get("sort") ?? "name").data ?? "name";
  const dir = DirSchema.safeParse(url.searchParams.get("dir") ?? "asc").data ?? "asc";
  const status = StatusSchema.safeParse(url.searchParams.get("status") ?? "ALL").data ?? "ALL";

  const page = clampInt(url.searchParams.get("page"), 1, 1, 9999);
  const pageSize = clampInt(url.searchParams.get("pageSize"), 25, 5, 100);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = createAdminSupabase();

  // CLIENT users can only see companies assigned via company_access
  let allowedCompanyIds: string[] | null = null;
  if (auth.role === "CLIENT") {
    try {
      allowedCompanyIds = await getAllowedCompanyIds(admin, auth.userId);
      if (allowedCompanyIds.length === 0) return NextResponse.json({ items: [], total: 0, page, pageSize });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? "Failed to load access" }, { status: 500 });
    }
  }

  // If filtering by derived status, we need to compute eligible company IDs first.
  let filteredCompanyIds: string[] | null = null;
  let filteredTotal: number | null = null;
  let activeSetForFiltered: Set<string> | null = null;

  if (status !== "ALL") {
    let base = admin.from("companies").select("id");

    if (allowedCompanyIds) base = base.in("id", allowedCompanyIds);

    if (q.length >= 2) {
      const safe = escapeILike(q);
      base = base.or(`name.ilike.%${safe}%,ref_id.ilike.%${safe}%,industry.ilike.%${safe}%`);
    }

    const { data: baseIdsData, error: baseErr } = await base.range(0, 4999);
    if (baseErr) return NextResponse.json({ error: baseErr.message }, { status: 400 });

    const baseIds = (baseIdsData ?? []).map((r: any) => r.id as string).filter(Boolean);

    if (baseIds.length === 0) return NextResponse.json({ items: [], total: 0, page, pageSize });

    try {
      const activeSet = await getActiveCompanyIdSet(admin, baseIds);
      activeSetForFiltered = activeSet;

      const finalIds = status === "ACTIVE" ? Array.from(activeSet) : baseIds.filter((id) => !activeSet.has(id));

      filteredCompanyIds = finalIds;
      filteredTotal = finalIds.length;

      if (filteredTotal === 0) return NextResponse.json({ items: [], total: 0, page, pageSize });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? "Failed to compute status" }, { status: 500 });
    }
  }

  let query = admin
    .from("companies")
    .select("id,ref_id,name,industry,website,description,created_at,updated_at,logo_mime", {
      count: status === "ALL" ? "exact" : undefined
    });

  if (filteredCompanyIds) query = query.in("id", filteredCompanyIds);
  else if (allowedCompanyIds) query = query.in("id", allowedCompanyIds);

  if (!filteredCompanyIds && q.length >= 2) {
    const safe = escapeILike(q);
    query = query.or(`name.ilike.%${safe}%,ref_id.ilike.%${safe}%,industry.ilike.%${safe}%`);
  }

  query = query.order(sort, { ascending: dir === "asc" }).range(from, to);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []) as any[];
  const pageIds = rows.map((c) => c.id as string).filter(Boolean);

  let activeSet: Set<string>;
  try {
    activeSet = activeSetForFiltered ?? (await getActiveCompanyIdSet(admin, pageIds));
  } catch {
    activeSet = new Set<string>();
  }

  const items = rows.map((c) => ({
    ...c,
    has_logo: Boolean(c.logo_mime),
    derived_status: activeSet.has(c.id) ? "ACTIVE" : "INACTIVE"
  }));

  return NextResponse.json({
    items,
    total: status === "ALL" ? count ?? items.length : filteredTotal ?? items.length,
    page,
    pageSize
  });
}

const CompanyFormSchema = z.object({
  ref_id: z.string().regex(/^[A-Z]{3}[0-9]{3}$/, "Ref ID must be AAA000 (e.g., KMP001)"),
  name: z.string().min(2).max(160),
  description: z.string().max(4000).optional().nullable(),
  industry: z.string().max(180).optional().nullable(),
  website: z.string().max(300).optional().nullable()
});

const MAX_LOGO_BYTES = 200_000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

async function processLogo(file: File) {
  const mime = file.type || "";
  if (!ALLOWED_MIME.has(mime)) throw new Error("Logo must be a PNG or JPEG");
  if (file.size > MAX_LOGO_BYTES) throw new Error("Logo must be 200KB or smaller");
  const buf = Buffer.from(await file.arrayBuffer());
  return { base64: buf.toString("base64"), mime };
}

export async function POST(req: NextRequest) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const form = await req.formData();

  const payload = {
    ref_id: String(form.get("ref_id") ?? "").trim().toUpperCase(),
    name: String(form.get("name") ?? "").trim(),
    description: String(form.get("description") ?? "").trim() || null,
    industry: String(form.get("industry") ?? "").trim() || null,
    website: String(form.get("website") ?? "").trim() || null
  };

  const parsed = CompanyFormSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const admin = createAdminSupabase();

  const { data: created, error: createErr } = await admin
    .from("companies")
    .insert({
      ref_id: parsed.data.ref_id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      industry: parsed.data.industry ?? null,
      website: parsed.data.website ?? null
    })
    .select("id,ref_id,name")
    .single();

  if (createErr || !created) {
    return NextResponse.json({ error: createErr?.message ?? "Failed to create company" }, { status: 400 });
  }

  const logoFile = form.get("logo");
  if (logoFile && logoFile instanceof File && logoFile.size > 0) {
    try {
      const logo = await processLogo(logoFile);

      const { error: rpcErr } = await admin.rpc("set_company_logo", {
        p_company_id: created.id,
        p_logo_base64: logo.base64,
        p_logo_mime: logo.mime
      });

      if (rpcErr) {
        return NextResponse.json({ error: `Company created, but logo upload failed: ${rpcErr.message}` }, { status: 400 });
      }
    } catch (e: any) {
      return NextResponse.json({ error: `Company created, but logo upload failed: ${e?.message ?? "Unknown error"}` }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, company: created });
}
