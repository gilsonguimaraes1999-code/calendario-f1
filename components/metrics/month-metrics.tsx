import { Activity, CalendarX2, Clock3, TimerReset } from "lucide-react";
import type { MonthlyMetrics } from "@/features/incidents/types";

export function MonthMetrics({ metrics }: { metrics: MonthlyMetrics }) {
  const partialMinutes = metrics.unavailableMinutes - metrics.fullDays * 1440;
  const hours = Math.floor(partialMinutes / 60);
  const duration = hours ? `${hours}h ${String(partialMinutes % 60).padStart(2, "0")}min` : `${partialMinutes} min`;
  return (
    <section className="month-metrics" aria-label="Métricas do mês" aria-live="polite">
      <article className="metric-card metric-card--availability panel"><div className="metric-card__label"><span>Disponibilidade estimada</span><Activity size={17} /></div><strong>{metrics.availabilityPercent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<small>%</small></strong><p>Base de 24h por dia · {metrics.totalDays} dias</p></article>
      <article className="metric-card panel"><div className="metric-card__label"><span>Dias afetados</span><CalendarX2 size={17} /></div><strong>{metrics.affectedDays}<small> / {metrics.totalDays}</small></strong><p>{metrics.fullDays} {metrics.fullDays === 1 ? "inteiro" : "inteiros"} <span>·</span> {metrics.partialDays} {metrics.partialDays === 1 ? "parcial" : "parciais"}</p></article>
      <article className="metric-card panel"><div className="metric-card__label"><span>Interrupções parciais</span><TimerReset size={17} /></div><strong>{metrics.interruptions.toString().padStart(2, "0")}</strong><p>Ocorrências com início e fim</p></article>
      <article className="metric-card panel"><div className="metric-card__label"><span>Tempo de falhas parciais</span><Clock3 size={17} /></div><strong className="metric-card__duration">{duration}</strong><p>Intervalos sobrepostos contados uma vez</p></article>
    </section>
  );
}
