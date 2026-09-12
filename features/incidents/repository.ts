import type { SupabaseClient } from "@supabase/supabase-js";
import { incidentSchema } from "./schemas";
import type { Incident, IncidentInput } from "./types";

const columns = "id,incident_date,kind,start_time,end_time,note,author_id";
type Scope = { userId: string; viewAll: boolean };
type Row = { id: string; incident_date: string; kind: string; start_time: string | null; end_time: string | null; note: string; author_id: string | null };

function fromRow(row: Row): Incident {
  const minute = (value: string | null) => value === null ? null : /^\d{2}:\d{2}(:00(\.0+)?)?$/.test(value) ? value.slice(0, 5) : value;
  return incidentSchema.parse({ id: row.id, date: row.incident_date, kind: row.kind, startTime: minute(row.start_time), endTime: minute(row.end_time), note: row.note, authorId: row.author_id });
}
function toRow(input: IncidentInput) {
  return { incident_date: input.date, kind: input.kind, start_time: input.startTime, end_time: input.endTime, note: input.note };
}

// Scope is derived from verified server identity, never from action arguments.
export function incidentRepository(client: SupabaseClient, scope: Scope) {
  return {
    async list(year: number, month: number): Promise<Incident[]> {
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const incidents: Incident[] = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        let query = client.from("incidents").select(columns).gte("incident_date", `${prefix}-01`).lte("incident_date", `${prefix}-${last}`).order("incident_date").order("start_time").order("id").range(offset, offset + pageSize - 1);
        if (!scope.viewAll) query = query.eq("author_id", scope.userId);
        const { data, error } = await query;
        if (error) throw error;
        incidents.push(...(data ?? []).map((row) => fromRow(row as Row)));
        if (!data || data.length < pageSize) return incidents;
      }
    },
    async create(input: IncidentInput): Promise<Incident | null> {
      const { data, error } = await client.from("incidents").insert(toRow(input)).select(columns).single();
      if (error) throw error;
      return data ? fromRow(data as Row) : null;
    },
    async update(id: string, input: IncidentInput): Promise<Incident | null> {
      let query = client.from("incidents").update(toRow(input)).eq("id", id);
      if (!scope.viewAll) query = query.eq("author_id", scope.userId);
      const { data, error } = await query.select(columns).maybeSingle();
      if (error) throw error;
      return data ? fromRow(data as Row) : null;
    },
    async remove(id: string): Promise<boolean> {
      let query = client.from("incidents").delete().eq("id", id);
      if (!scope.viewAll) query = query.eq("author_id", scope.userId);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw error;
      return !!data;
    },
  };
}
