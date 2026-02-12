import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "OPS", "CLIENT"]),
  display_name: z.string().min(1).max(120).nullable().optional(),
  // Optional: assign company access at creation time (Ref IDs like KMP001)
  company_ref_ids: z.array(z.string().regex(/^[A-Z]{3}[0-9]{3}$/)).optional()
});

export async function POST(req: Request) {
  // 1) Ensure requester is logged in
  const supabase = createServerSupabase();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) Ensure requester is ADMIN
  const { data: profile, error: profErr } = await supabase
    .from("app_users")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profErr || profile?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // 3) Validate payload
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  // 4) Create user using service role
  const admin = createAdminSupabase();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create user" },
      { status: 400 }
    );
  }

  // 5) Ensure app_users row has correct role + name
  const { error: upsertErr } = await admin.from("app_users").upsert({
    id: data.user.id,
    role: parsed.data.role,
    display_name: parsed.data.display_name ?? null
  });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // 6) Optional: assign company access using Ref IDs
  const refs = parsed.data.company_ref_ids ?? [];
  if (refs.length > 0) {
    const { data: companies, error: compErr } = await admin
      .from("companies")
      .select("id, ref_id")
      .in("ref_id", refs);

    if (compErr) {
      return NextResponse.json({ error: compErr.message }, { status: 500 });
    }

    const rows =
      (companies ?? []).map((c) => ({
        user_id: data.user!.id,
        company_id: c.id
      })) ?? [];

    if (rows.length > 0) {
      const { error: caErr } = await admin
        .from("company_access")
        .upsert(rows, { onConflict: "user_id,company_id" });

      if (caErr) {
        return NextResponse.json({ error: caErr.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email },
    role: parsed.data.role,
    company_ref_ids: refs
  });
}
