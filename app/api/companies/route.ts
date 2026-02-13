import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

const SortSchema = z.enum(["name", "ref_id", "created_at"]);
const DirSchema = z.enum(["asc", "desc"]);

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export async function GET(req: Request) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const sort = SortSchema.safeParse(url.searchParams.get("sort") ?? "name").data ?? "name";
  const dir = DirSchema.safeParse(url.searchParams.get("dir") ?? "asc").data ?? "asc";
  const page = clampInt(url.searchParams.get("page"), 1, 1, 9999);
  const pageSize = clampInt(url.searchParams.get("pageSize"), 25, 5, 100);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = createAdminSupabase();

  // CLIENT users can only see companies assigned via company_access
  let allowedCompanyIds: string[] | null = null;
  if (auth.role === "CLIENT") {
    const { data: access, error: accessErr } = await admin
      .from("company_access")
      .select("company_id")
      .eq("user_id", auth.userId);

    if (accessErr) {
      return NextResponse.json({ error: accessErr.message }, { status: 500 });
    }

    allowedCompanyIds = (access ?? []).map((r) => r.company_id);

    // No access -> empty list (not an error)
    if (allowedCompanyIds.length === 0) {
      return NextResponse.json({ items: [], total: 0, page, pageSize });
    }
  }

  let query = admin
    .from("companies")
    .select("id,ref_id,name,industry,website,description,created_at,updated_at,logo_mime", { count: "exact" });

  if (allowedCompanyIds) {
    query = query.in("id", allowedCompanyIds);
  }

  if (q.length >= 2) {
    const safe = q.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = query.or(
      `name.ilike.%${safe}%,ref_id.ilike.%${safe}%,industry.ilike.%${safe}%`
    );
  }

  query = query.order(sort, { ascending: dir === "asc" }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const items =
    (data ?? []).map((c) => ({
      ...c,
      has_logo: Boolean(c.logo_mime)
    })) ?? [];

  return NextResponse.json({
    items,
    total: count ?? items.length,
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
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Logo must be a PNG or JPEG");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("Logo must be 200KB or smaller");
  }

  const buf = Buffer.from(await file.arrayBuffer());

  return { base64: buf.toString("base64"), mime };
}

export async function POST(req: Request) {
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
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();

  // Create company
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
        return NextResponse.json(
          { error: `Company created, but logo upload failed: ${rpcErr.message}` },
          { status: 400 }
        );
      }
    } catch (e: any) {
      return NextResponse.json(
        { error: `Company created, but logo upload failed: ${e?.message ?? "Unknown error"}` },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ ok: true, company: created });
}
