import { redirect } from "next/navigation";
import { requireSession } from "@/features/auth/guards";
import { canManageUsers } from "@/features/users/access";
import { listUsers } from "@/features/users/actions";
import { UsersWorkspace } from "@/components/users/users-workspace";
export default async function UsersPage() {
  const context=await requireSession();
  if(!canManageUsers(context)) redirect(context.access==="allow"?"/calendar":"/pending");
  const result=await listUsers();
  return <UsersWorkspace currentUserId={context.user.id} initialUsers={result.ok?result.users:[]} initialError={result.ok?undefined:result.message}/>;
}
