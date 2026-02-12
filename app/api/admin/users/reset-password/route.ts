import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BodySchema = z.object({
  user_id: z.string().uuid(),
  new_password: z.string().min(8, "Password must be at least 8 characters")
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

  // 4) Reset password using service role
  const admin = createAdminSupabase();
  const { data, error } = await admin.auth.admin.updateUserById(parsed.data.user_id, {
    password: parsed.data.new_password
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    user: { id: data.user.id, email: data.user.email }
  });
}
