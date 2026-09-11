"use client";

import { MessageSquare } from "lucide-react";
import type { Incident } from "@/features/incidents/types";
import { aggregateMonth } from "@/features/incidents/metrics";

type CalendarDayProps = {
  date: string;
  incidents: Incident[];
  today: boolean;
  onSelect: (date: string) => void;
};

export function CalendarDay({ date, incidents, today, onSelect }: CalendarDayProps) {
  const [year, month, day] = date.split("-").map(Number);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const metrics = aggregateMonth(incidents, year, month);
  const state = metrics.fullDays ? "full-day" : incidents.length ? "partial" : "normal";
  const interruptionLabel = `${incidents.length} ${incidents.length === 1 ? "interrupção" : "interrupções"}`;
  const statusLabel = state === "full-day" ? "indisponível durante todo o dia" : state === "partial" ? `${interruptionLabel}, ${metrics.unavailableMinutes} minutos` : "sem ocorrência registrada";

  return (
    <button type="button" className="calendar-day" data-state={state} aria-label={`${dateLabel}, ${statusLabel}`} aria-current={today ? "date" : undefined} onClick={() => onSelect(date)}>
      <span className="calendar-day__top"><span className="calendar-day__number">{day}</span>{today && <span className="calendar-day__today">hoje</span>}<span className="calendar-day__dot" aria-hidden="true" /></span>
      {state === "full-day" && <span className="calendar-day__details"><strong>Dia inteiro</strong><span>24h indisponível</span></span>}
      {state === "partial" && <span className="calendar-day__details"><strong>{metrics.unavailableMinutes} min</strong><span>{interruptionLabel}</span></span>}
      {incidents.length > 1 && <span className="calendar-day__notes" aria-label={`${incidents.length} anotações`}><MessageSquare size={11} aria-hidden="true" />{incidents.length}</span>}
    </button>
  );
}
