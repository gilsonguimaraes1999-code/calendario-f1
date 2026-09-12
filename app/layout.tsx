import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calendário F1",
  description: "Acompanhamento mensal de indisponibilidades do F1.",
  icons: { icon: [{ url: "/santagroup-a.png?v=aebbb105", type: "image/png" }], shortcut: "/santagroup-a.png?v=aebbb105", apple: "/santagroup-a.png?v=aebbb105" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="pt-BR"><body><div className="app-shell">{children}</div></body></html>;
}
