import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getApiAuth } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsedParams = ParamsSchema.safeParse(ctx.params);
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const admin = createAdminSupabase();

  // CLIENT users can only fetch assigned company logos
  if (auth.role === "CLIENT") {
    const { data: access } = await admin
      .from("company_access")
      .select("company_id")
      .eq("user_id", auth.userId)
      .eq("company_id", parsedParams.data.id)
      .maybeSingle();

    if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await admin.rpc("get_company_logo", { p_company_id: parsedParams.data.id }).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data?.logo_base64 || !data?.logo_mime) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = Buffer.from(String(data.logo_base64), "base64");

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": String(data.logo_mime),
      "Cache-Control": "public, max-age=300"
    }
  });
}
