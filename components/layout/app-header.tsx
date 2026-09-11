import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export function AppHeader({ canManageUsers = false }: { canManageUsers?: boolean }) {
  return <header className="app-header"><div className="app-header__content"><Link href="/calendar" className="app-header__brand" aria-label="Calendário F1"><Image src="/angel-a.png" alt="" width={48} height={48} priority /><span><strong className="font-display">Calendário F1</strong><small>Disponibilidade operacional</small></span></Link><nav className="app-header__actions" aria-label="Navegação da conta">{canManageUsers && <Link href="/admin/users" className="nav-link">Usuários</Link>}<LogoutButton /></nav></div></header>;
}
