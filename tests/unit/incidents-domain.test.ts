import { describe, expect, it } from "vitest";

import { incidentSchema } from "@/features/incidents/schemas";
import { aggregateMonth, calculateDurationMinutes } from "@/features/incidents/metrics";
import { buildMonthlySummary } from "@/features/incidents/summary";
import type { Incident } from "@/features/incidents/types";

const incidents: Incident[] = [
  { id: "a", date: "2026-09-02", kind: "partial", startTime: "10:00", endTime: "10:20", note: "queda", authorId: "u" },
  { id: "b", date: "2026-09-03", kind: "full_day", startTime: null, endTime: null, note: "offline", authorId: "u" },
];

describe("incident domain", () => {
  it("calculates the minutes between valid times", () => {
    expect(calculateDurationMinutes("10:00", "10:20")).toBe(20);
  });

  it("rejects an end time that is not after the start", () => {
    expect(() => calculateDurationMinutes("10:20", "10:00")).toThrow();
    expect(() => calculateDurationMinutes("10:00", "10:00")).toThrow();
  });

  it("validates fields required by each incident kind", () => {
    expect(incidentSchema.safeParse(incidents[0]).success).toBe(true);
    expect(incidentSchema.safeParse(incidents[1]).success).toBe(true);
    expect(incidentSchema.safeParse({ ...incidents[0], endTime: "10:00" }).success).toBe(false);
    expect(incidentSchema.safeParse({ ...incidents[1], startTime: "10:00" }).success).toBe(false);
  });

  it("aggregates full and partial incidents in the selected month", () => {
    expect(aggregateMonth(incidents, 2026, 9)).toMatchObject({
      affectedDays: 2, fullDays: 1, partialDays: 1, interruptions: 1,
      unavailableMinutes: 1460, totalMinutes: 43_200, availabilityPercent: 96.62,
    });
  });

  it("ignores incidents outside the selected month", () => {
    expect(aggregateMonth([...incidents, { ...incidents[0], id: "c", date: "2026-10-01" }], 2026, 9))
      .toMatchObject({ affectedDays: 2, unavailableMinutes: 1460 });
  });

  it("returns full availability for an empty month", () => {
    expect(aggregateMonth([], 2024, 2)).toMatchObject({
      affectedDays: 0, unavailableMinutes: 0, totalMinutes: 41_760, availabilityPercent: 100,
    });
  });

  it("builds an empty-month summary", () => {
    expect(buildMonthlySummary(aggregateMonth([], 2026, 9))).toBe(
      "Em setembro, o F1 não apresentou falhas.",
    );
  });

  it("builds a grammatical summary for one full-day incident", () => {
    expect(buildMonthlySummary(aggregateMonth([incidents[1]], 2026, 9))).toBe(
      "Em setembro, o F1 apresentou falha em 1 dia. Nesse dia, o F1 não funcionou durante todo o dia.",
    );
  });

  it("counts duplicate full-day records as one day of downtime", () => {
    expect(aggregateMonth([incidents[1], { ...incidents[1], id: "duplicate" }], 2026, 9))
      .toMatchObject({ affectedDays: 1, fullDays: 1, partialDays: 0, interruptions: 0, unavailableMinutes: 1440 });
  });

  it("makes a full-day record take precedence over partial records on that date", () => {
    expect(aggregateMonth([incidents[0], { ...incidents[1], date: "2026-09-02" }], 2026, 9)).toMatchObject({
      affectedDays: 1, fullDays: 1, partialDays: 0, interruptions: 0, unavailableMinutes: 1440,
    });
  });

  it("unions overlapping partial intervals while retaining their interruption count", () => {
    expect(aggregateMonth([
      { ...incidents[0], startTime: "10:00", endTime: "11:00" },
      { ...incidents[0], id: "overlap", startTime: "10:30", endTime: "11:30" },
    ], 2026, 9)).toMatchObject({
      affectedDays: 1, fullDays: 0, partialDays: 1, interruptions: 2, unavailableMinutes: 90,
    });
  });

  it("builds deterministic Portuguese text with singular words", () => {
    expect(buildMonthlySummary(aggregateMonth([incidents[0]], 2026, 9))).toBe(
      "Em setembro, o F1 apresentou falha em 1 dia. Esse dia acumulou 20 min de indisponibilidade, distribuída em 1 interrupção.",
    );
  });

  it("builds deterministic Portuguese text with plural words", () => {
    expect(buildMonthlySummary(aggregateMonth(incidents, 2026, 9), "pt-BR")).toBe(
      "Em setembro, o F1 apresentou falhas em 2 dias. Em 1 deles não funcionou durante todo o dia. O outro dia acumulou 20 min de indisponibilidade, distribuída em 1 interrupção.",
    );
  });
});
