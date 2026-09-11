import type { MonthlyMetrics } from "./types";
const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const word = (count: number, singular: string, plural: string) => count === 1 ? singular : plural;
function duration(minutes: number): string { const hours = Math.floor(minutes / 60); const remaining = minutes % 60; return hours === 0 ? `${minutes} min` : remaining === 0 ? `${hours}h` : `${hours}h${String(remaining).padStart(2, "0")}`; }
export function buildMonthlySummary(metrics: MonthlyMetrics, locale: "pt-BR" = "pt-BR"): string {
  void locale; const month = months[metrics.month - 1]; if (!month) throw new Error("Mês inválido");
  if (metrics.affectedDays === 0) return `Em ${month}, o F1 não apresentou falhas.`;
  let text = `Em ${month}, o F1 apresentou ${word(metrics.affectedDays, "falha", "falhas")} em ${metrics.affectedDays} ${word(metrics.affectedDays, "dia", "dias")}.`;
  if (metrics.fullDays > 0) text += metrics.affectedDays === 1 && metrics.fullDays === 1
    ? " Nesse dia, o F1 não funcionou durante todo o dia."
    : ` Em ${metrics.fullDays} deles não funcionou durante todo o dia.`;
  if (metrics.partialDays > 0) { const prefix = metrics.fullDays > 0 ? metrics.partialDays === 1 ? "O outro dia" : `Os outros ${metrics.partialDays} dias` : metrics.partialDays === 1 ? "Esse dia" : `Os ${metrics.partialDays} dias`; text += ` ${prefix} ${metrics.partialDays === 1 ? "acumulou" : "acumularam"} ${duration(metrics.unavailableMinutes - metrics.fullDays * 1440)} de indisponibilidade, ${metrics.interruptions === 1 ? "distribuída" : "distribuídas"} em ${metrics.interruptions} ${word(metrics.interruptions, "interrupção", "interrupções")}.`; }
  return text;
}
