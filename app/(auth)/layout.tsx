import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AppBackground } from "@/components/layout/app-background";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-shell"><AppBackground variant="stars" /><section className="auth-content"><Link className="auth-brand" href="/login"><Image src="/angel-a.png" alt="Calendário F1" width={208} height={208} priority /></Link>{children}</section></main>;
}
