import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminSupabase();

  let allowedCompanyIds: string[] | null = null;
  if (auth.role === "CLIENT") {
    const { data: access, error: accessErr } = await admin.from("company_access").select("company_id").eq("user_id", auth.userId);
    if (accessErr) return NextResponse.json({ error: accessErr.message }, { status: 500 });

    allowedCompanyIds = (access ?? []).map((r: any) => r.company_id as string);
    if (allowedCompanyIds.length === 0) return NextResponse.json({ items: [] });
  }

  let query = admin.from("companies").select("id,ref_id,name").order("name", { ascending: true });
  if (allowedCompanyIds) query = query.in("id", allowedCompanyIds);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ items: data ?? [] });
}
