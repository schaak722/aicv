import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();

  const url = new URL(req.url);
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}
