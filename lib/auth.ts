import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type AppRole = "ADMIN" | "OPS" | "CLIENT";

export async function requireUser() {
  const supabase = await createServerSupabase();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    redirect("/login");
  }

  const { data: profile, error: profErr } = await supabase
    .from("app_users")
    .select("role, display_name")
    .eq("id", userData.user.id)
    .maybeSingle();

  // If profile not present yet, still let them in as CLIENT (trigger should create it)
  const role = (profile?.role ?? "CLIENT") as AppRole;
  const displayName = profile?.display_name ?? userData.user.email ?? "User";

  return { user: userData.user, role, displayName };
}

export function requireRole(role: AppRole, actual: AppRole) {
  const order: Record<AppRole, number> = { CLIENT: 1, OPS: 2, ADMIN: 3 };
  if (order[actual] < order[role]) {
    redirect("/dashboard");
  }
}
