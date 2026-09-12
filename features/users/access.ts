import type { getAccessContext } from "@/features/auth/guards";
export function canManageUsers(context: Awaited<ReturnType<typeof getAccessContext>>) {
  return !!context && (context.profile?.role === "owner" || (context.profile?.status === "approved" && context.permissions.can_manage_users));
}
