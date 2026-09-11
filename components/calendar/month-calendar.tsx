"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Incident } from "@/features/incidents/types";
import { CalendarDay } from "./calendar-day";

type MonthCalendarProps = {
  year: number;
  month: number;
  incidents: Incident[];
  today?: string;
  onSelectDay: (date: string) => void;
  onChangeMonth?: (year: number, month: number) => void;
};

export function MonthCalendar({ year, month, incidents, today, onSelectDay, onChangeMonth }: MonthCalendarProps) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(monthStart);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (monthStart.getUTCDay() + 6) % 7;
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const byDate = new Map<string, Incident[]>();
  for (const incident of incidents) byDate.set(incident.date, [...(byDate.get(incident.date) ?? []), incident]);

  function moveMonth(direction: number) {
    const next = new Date(Date.UTC(year, month - 1 + direction, 1));
    onChangeMonth?.(next.getUTCFullYear(), next.getUTCMonth() + 1);
  }

  return (
    <section className="month-calendar panel" aria-label="Calendário mensal">
      <div className="month-calendar__toolbar">
        <div className="month-calendar__title"><h2>{monthName} <span>{year}</span></h2><span className="eyebrow">Visão mensal</span></div>
        <div className="month-calendar__navigation">
          <button type="button" className="button-quiet today-button" disabled={!onChangeMonth} onClick={() => {
            const now = today ? new Date(`${today}T12:00:00`) : new Date();
            onChangeMonth?.(now.getFullYear(), now.getMonth() + 1);
          }}>Hoje</button>
          <button type="button" className="icon-button" aria-label="Mês anterior" disabled={!onChangeMonth} onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button>
          <button type="button" className="icon-button" aria-label="Próximo mês" disabled={!onChangeMonth} onClick={() => moveMonth(1)}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {Array.from({ length: cells }, (_, index) => {
          const day = index - offset + 1;
          if (day < 1 || day > daysInMonth) return <div key={index} className="calendar-day calendar-day--outside" aria-hidden="true" />;
          const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return <CalendarDay key={date} date={date} incidents={byDate.get(date) ?? []} today={today === date} onSelect={onSelectDay} />;
        })}
      </div>
      <div className="calendar-legend"><span><i className="status-dot status-dot--normal" />Sem registro</span><span><i className="status-dot status-dot--partial" />Parcial</span><span><i className="status-dot status-dot--full" />Dia inteiro</span><small>Selecione um dia para ver ou registrar ocorrências</small></div>
    </section>
  );
}
