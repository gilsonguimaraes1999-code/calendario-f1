import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/features/auth/guards";

export default async function PendingPage() {
  const context = await requireSession();
  if (context.access === "allow") redirect("/calendar");
  const status = context.profile?.status;
  const heading = status === "pending" ? "Aguardando aprovação" : status === "rejected" ? "Solicitação não aprovada" : status === "suspended" ? "Acesso suspenso" : "Acesso indisponível";
  const message = status === "pending" ? "Sua solicitação foi recebida. Assim que o administrador aprovar seu acesso, o calendário ficará disponível." : status === "rejected" ? "Sua solicitação não foi aprovada. Fale com o administrador para esclarecer os próximos passos." : status === "suspended" ? "Seu acesso está suspenso. Fale com o administrador para solicitar uma revisão." : "Sua conta ainda não tem permissão para visualizar o calendário. Fale com o administrador.";
  return <main className="access-status panel"><span className="eyebrow">Calendário F1</span><h1>{heading}</h1><p>{message}</p><Link className="button-gold" href="/calendar" prefetch={false}>Verificar meu acesso</Link></main>;
}
