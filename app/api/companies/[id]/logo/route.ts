import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getApiAuth } from "@/lib/server/apiAuth";
import type { RouteContext } from "@/lib/server/routeTypes";

export const runtime = "nodejs";

const ParamsSchema = z.object({ id: z.string().uuid() });

type CompanyLogoRpcRow = {
  logo_base64: string | null;
  logo_mime: string | null;
};

export async function GET(_req: NextRequest, { params }: RouteContext<{ id: string }>) {
  const auth = await getApiAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsedParams = ParamsSchema.safeParse(await params);
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

  const { data, error } = await admin.rpc("get_company_logo", {
    p_company_id: parsedParams.data.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const row = (Array.isArray(data) ? data[0] : data) as CompanyLogoRpcRow | null;

  if (!row?.logo_base64 || !row?.logo_mime)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = Buffer.from(String(row.logo_base64), "base64");

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": String(row.logo_mime),
      "Cache-Control": "public, max-age=300",
    },
  });
}
