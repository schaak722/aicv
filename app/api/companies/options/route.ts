import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

const QuerySchema = z.object({
  q: z.string().optional(),
});

export async function GET(req: Request) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ q: url.searchParams.get("q") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const q = (parsed.data.q ?? "").trim();
  const supabase = await createServerSupabase();

  let query = supabase
    .from("companies")
    .select("id, ref_id, name")
    .order("name", { ascending: true })
    .limit(20);

  if (q) {
    // simple search on name/ref_id
    query = query.or(`name.ilike.%${q}%,ref_id.ilike.%${q}%`);
  }

  // If CLIENT, restrict to assigned companies
  if (auth.role === "CLIENT") {
    const { data: access } = await supabase
      .from("company_access")
      .select("company_id")
      .eq("user_id", auth.userId);

    const ids = (access ?? []).map((x: any) => x.company_id);
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ options: data ?? [] });
}
