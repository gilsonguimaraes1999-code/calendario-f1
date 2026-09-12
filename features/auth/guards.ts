import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AccessStatus = "pending" | "approved" | "rejected" | "suspended";
export function resolveAccess(profile: { status: AccessStatus; role?: "owner" | "member"; can_view: boolean } | null): "allow" | "pending" | "deny" {
  if (!profile) return "deny";
  if (profile.role === "owner") return "allow";
  if (profile.status === "pending") return "pending";
  return profile.status === "approved" && profile.can_view ? "allow" : "deny";
}

const profileSchema = z.object({ id: z.string(), full_name: z.string(), status: z.enum(["pending", "approved", "rejected", "suspended"]), role: z.enum(["owner", "member"]) });
const permissionsSchema = z.object({ can_view: z.boolean(), can_view_all: z.boolean().default(false), can_create: z.boolean(), can_edit: z.boolean(), can_delete: z.boolean(), can_manage_users: z.boolean() });
export type Permissions = z.infer<typeof permissionsSchema>;
const deniedPermissions: Permissions = { can_view: false, can_view_all: false, can_create: false, can_edit: false, can_delete: false, can_manage_users: false };

export async function getAccessContext() {
  try {
    const client = await createServerSupabaseClient();
    if (!client) return null;
    // Validate with Auth, never trust an unverified cookie session.
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    const [profileResult, permissionResult] = await Promise.all([
      client.from("profiles").select("id,full_name,status,role").eq("id", data.user.id).maybeSingle(),
      client.from("permissions").select("can_view,can_view_all,can_create,can_edit,can_delete,can_manage_users").eq("profile_id", data.user.id).maybeSingle(),
    ]);
    const parsed = profileSchema.safeParse(profileResult.error ? null : profileResult.data);
    const profile = parsed.success ? parsed.data : null;
    const parsedPermissions = permissionsSchema.safeParse(permissionResult.error ? null : permissionResult.data);
    const permissions = profile?.role === "owner" ? { can_view: true, can_view_all: true, can_create: true, can_edit: true, can_delete: true, can_manage_users: true } : parsedPermissions.success ? parsedPermissions.data : deniedPermissions;
    return { user: data.user, profile, permissions, access: resolveAccess(profile ? { ...profile, can_view: permissions.can_view } : null) };
  } catch { return null; }
}

export async function requireSession() {
  const context = await getAccessContext();
  if (!context) redirect("/login");
  return context;
}

export async function requireApprovedUser() {
  const context = await requireSession();
  if (context.access !== "allow") redirect("/pending");
  return context;
}
