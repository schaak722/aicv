import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

const ParamsSchema = z.object({ id: z.string().uuid() });

const CompanyFormSchema = z.object({
  ref_id: z.string().regex(/^[A-Z]{3}[0-9]{3}$/, "Ref ID must be AAA000 (e.g., KMP001)"),
  name: z.string().min(2).max(160),
  description: z.string().max(4000).optional().nullable(),
  industry: z.string().max(180).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  remove_logo: z.enum(["0", "1"]).optional()
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

async function canAccessCompany(admin: ReturnType<typeof createAdminSupabase>, userId: string, role: string, companyId: string) {
  if (role !== "CLIENT") return true;
  const { data, error } = await admin
    .from("company_access")
    .select("company_id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsedParams = ParamsSchema.safeParse(ctx.params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const admin = createAdminSupabase();
  const ok = await canAccessCompany(admin, auth.userId, auth.role, parsedParams.data.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await admin
    .from("companies")
    .select("id,ref_id,name,industry,website,description,created_at,updated_at,logo_mime")
    .eq("id", parsedParams.data.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    company: { ...data, has_logo: Boolean(data.logo_mime) }
  });
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsedParams = ParamsSchema.safeParse(ctx.params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

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
    website: String(form.get("website") ?? "").trim() || null,
    remove_logo: String(form.get("remove_logo") ?? "0") as "0" | "1"
  };

  const parsed = CompanyFormSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();

  const { error: updErr } = await admin
    .from("companies")
    .update({
      ref_id: parsed.data.ref_id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      industry: parsed.data.industry ?? null,
      website: parsed.data.website ?? null
    })
    .eq("id", parsedParams.data.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  const logoFile = form.get("logo");

  if (parsed.data.remove_logo === "1") {
    const { error: rpcErr } = await admin.rpc("clear_company_logo", { p_company_id: parsedParams.data.id });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });
  } else if (logoFile && logoFile instanceof File && logoFile.size > 0) {
    try {
      const logo = await processLogo(logoFile);
      const { error: rpcErr } = await admin.rpc("set_company_logo", {
        p_company_id: parsedParams.data.id,
        p_logo_base64: logo.base64,
        p_logo_mime: logo.mime
      });
      if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? "Logo upload failed" }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
