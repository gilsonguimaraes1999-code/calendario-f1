import type { ReactNode } from "react";
import { AppBackground } from "@/components/layout/app-background";
import { AppHeader } from "@/components/layout/app-header";
import { requireSession } from "@/features/auth/guards";
import { canManageUsers } from "@/features/users/access";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const context = await requireSession();
  return <><AppBackground variant="vector" /><div className="private-shell"><AppHeader canManageUsers={canManageUsers(context)} />{children}</div></>;
}
