import type { Incident, MonthlyMetrics } from "./types";
const DAY = 1440;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
function minuteOfDay(time: string): number { if (!timePattern.test(time)) throw new Error("Horário inválido"); const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; }
export function calculateDurationMinutes(start: string, end: string): number { const duration = minuteOfDay(end) - minuteOfDay(start); if (duration <= 0) throw new Error("O horário final deve ser posterior ao inicial"); return duration; }
function unionDuration(items: Incident[]): number {
  const intervals = items.map((item) => {
    if (item.startTime === null || item.endTime === null) throw new Error("Horário inválido");
    return [minuteOfDay(item.startTime), minuteOfDay(item.endTime)] as const;
  }).sort(([startA], [startB]) => startA - startB);
  let total = 0;
  let start = -1;
  let end = -1;
  for (const [nextStart, nextEnd] of intervals) {
    if (nextEnd <= nextStart) throw new Error("O horário final deve ser posterior ao inicial");
    if (start === -1) { start = nextStart; end = nextEnd; continue; }
    if (nextStart <= end) { end = Math.max(end, nextEnd); continue; }
    total += end - start;
    start = nextStart;
    end = nextEnd;
  }
  return start === -1 ? 0 : total + end - start;
}
export function aggregateMonth(items: Incident[], year: number, month: number): MonthlyMetrics {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Mês inválido");
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const matches = items.filter(({ date }) => date.startsWith(`${year}-${String(month).padStart(2, "0")}-`));
  const byDate = new Map<string, Incident[]>();
  for (const item of matches) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);
  let fullDays = 0;
  let partialDays = 0;
  let interruptions = 0;
  let unavailableMinutes = 0;
  for (const dayItems of byDate.values()) {
    if (dayItems.some((item) => item.kind === "full_day")) { fullDays += 1; unavailableMinutes += DAY; continue; }
    partialDays += 1;
    interruptions += dayItems.length;
    unavailableMinutes += unionDuration(dayItems);
  }
  const totalMinutes = totalDays * DAY;
  return { year, month, totalDays, totalMinutes, affectedDays: byDate.size, fullDays, partialDays, interruptions, unavailableMinutes, availabilityPercent: Number((Math.max(0, (totalMinutes - unavailableMinutes) / totalMinutes) * 100).toFixed(2)) };
}
