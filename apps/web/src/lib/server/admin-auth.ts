import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";

export type AuthorizedStaff = {
  id: string;
  email: string;
  role: "front_desk" | "manager" | "admin";
};

export async function requireStaff(allowedRoles?: AuthorizedStaff["role"][]) {
  const startedAt = Date.now();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  console.info("[admin-auth] claims verified", { durationMs: Date.now() - startedAt, authenticated: Boolean(subject) });
  if (error || !subject) redirect("/admin/login");

  const { data: profileData, error: profileError } = await supabase.rpc("get_snowaz_staff_profile");
  const staff = Array.isArray(profileData) ? profileData[0] : null;
  console.info("[admin-auth] staff authorization checked", { durationMs: Date.now() - startedAt, authorized: Boolean(staff) });
  if (profileError || !staff) redirect("/admin/login?error=not-authorized");
  const role = staff.role as AuthorizedStaff["role"];
  if (allowedRoles && !allowedRoles.includes(role)) redirect("/admin?error=forbidden");
  return { id: staff.id as string, email: staff.email as string, role } satisfies AuthorizedStaff;
}
