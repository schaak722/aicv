import { createServerSupabase } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth";

/**
 * API helper: returns authenticated user id + role (from app_users).
 * Uses Supabase session cookies via @supabase/ssr.
 */
export async function getApiAuth() {
  const supabase = await createServerSupabase();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false as const, status: 401, error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("app_users")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  const role = (profile?.role ?? "CLIENT") as AppRole;

  return {
    ok: true as const,
    userId: userData.user.id,
    role
  };
}
