export type Incident = { id: string; date: string; kind: "partial" | "full_day"; startTime: string | null; endTime: string | null; note: string; authorId: string | null; };
export type IncidentInput = Omit<Incident, "id" | "authorId">;
export type IncidentError = { ok: false; code: "unauthenticated" | "forbidden" | "validation" | "conflict" | "not_found" | "unavailable"; message: string };
export type IncidentResult<T> = ({ ok: true } & T) | IncidentError;
export type MonthlyMetrics = { year: number; month: number; totalDays: number; totalMinutes: number; affectedDays: number; fullDays: number; partialDays: number; interruptions: number; unavailableMinutes: number; availabilityPercent: number; };
