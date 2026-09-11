import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import { requireApprovedUser } from "@/features/auth/guards";
import { listIncidentsForMonth } from "@/features/incidents/actions";
import { monthSchema } from "@/features/incidents/schemas";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const context = await requireApprovedUser();
  const initialDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const requested = (await searchParams).month;
  const month = requested ?? initialDate.slice(0, 7);
  const parsed = /^\d{4}-\d{2}$/.test(month) ? monthSchema.safeParse({ year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) }) : null;
  if (!parsed?.success) return <CalendarWorkspace initialDate={initialDate} initialIncidents={[]} permissions={context.permissions} initialError="Mês inválido. Atualize para voltar ao mês atual." />;
  const result = await listIncidentsForMonth(parsed.data.year, parsed.data.month);
  return <CalendarWorkspace initialDate={initialDate} initialMonth={month} initialIncidents={result.ok ? result.incidents : []} permissions={result.ok ? result.permissions : context.permissions} initialError={result.ok ? "" : result.message} />;
}
