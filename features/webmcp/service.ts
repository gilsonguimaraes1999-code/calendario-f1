import { createIncident, listIncidentsForMonth } from "@/features/incidents/actions";
import { monthSchema } from "@/features/incidents/schemas";
import { aggregateMonth } from "@/features/incidents/metrics";
import { buildMonthlySummary } from "@/features/incidents/summary";
import type { IncidentError } from "@/features/incidents/types";
export async function executeCalendarTool(tool: string, input: unknown) {
  if (tool === "register_incident") return createIncident(input);
  if (tool === "consult_calendar_month") {
    const parsed = monthSchema.safeParse(input);
    if (parsed.success) {
      const { year, month } = parsed.data;
      const result = await listIncidentsForMonth(year, month);
      if (!result.ok) return result;
      const metrics = aggregateMonth(result.incidents, year, month);
      return { ...result, metrics, summary: buildMonthlySummary(metrics) };
    }
  }
  return { ok: false, code: "validation", message: "Ferramenta ou parâmetros inválidos. Confira os dados informados." } satisfies IncidentError;
}
