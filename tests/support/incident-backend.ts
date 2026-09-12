// In-memory double of the external Supabase query boundary, not app policy.
export function incidentBackend() {
  const state = {
    user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
    status: "approved", role: "member", flags: { can_view: true, can_view_all: false, can_create: true, can_edit: true, can_delete: true, can_manage_users: false },
    rows: [] as Record<string, unknown>[], writes: [] as Record<string, unknown>[], error: null as { code: string; message: string } | null,
    filters: [] as [string, string, unknown][], nextId: 1,
  };
  function from(table: string) {
    let predicates: ((row: Record<string, unknown>) => boolean)[] = [];
    let operation = "select";
    let payload: Record<string, unknown> = {};
    let start = 0, end = Infinity;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { state.filters.push(["eq", key, value]); predicates.push((row) => row[key] === value); return query; },
      gte: (key: string, value: string) => { state.filters.push(["gte", key, value]); predicates.push((row) => String(row[key]) >= value); return query; },
      lte: (key: string, value: string) => { state.filters.push(["lte", key, value]); predicates.push((row) => String(row[key]) <= value); return query; },
      order: () => query,
      range: (first: number, last: number) => { start = first; end = last; return query; },
      insert: (input: Record<string, unknown>) => { operation = "insert"; payload = input; return query; },
      update: (input: Record<string, unknown>) => { operation = "update"; payload = input; return query; },
      delete: () => { operation = "delete"; return query; },
      maybeSingle: async () => { const result = await execute(); return { ...result, data: result.data?.[0] ?? null }; },
      single: async () => { const result = await execute(); return { ...result, data: result.data?.[0] ?? null }; },
      then: (resolve: (result: unknown) => unknown, reject: (cause: unknown) => unknown) => execute().then(resolve, reject),
    };
    async function execute() {
      if (table === "profiles") return { data: state.user ? [{ id: state.user.id, full_name: "Member", status: state.status, role: state.role }] : [], error: null };
      if (table === "permissions") return { data: [{ ...state.flags }], error: null };
      if (state.error) return { data: null, error: state.error };
      let matches = state.rows.filter((row) => predicates.every((predicate) => predicate(row)));
      if (operation === "insert") {
        state.writes.push(payload);
        const row = { ...payload, id: `22222222-2222-4222-8222-${String(state.nextId++).padStart(12, "0")}`, author_id: state.user?.id };
        state.rows.push(row); matches = [row];
      } else if (operation === "update") { state.writes.push(payload); for (const row of matches) Object.assign(row, payload); }
      else if (operation === "delete") state.rows = state.rows.filter((row) => !matches.includes(row));
      return { data: matches.slice(start, end + 1).map((row) => ({ ...row })), error: null };
    }
    return query;
  }
  return { state, client: { from, auth: { getUser: async () => ({ data: { user: state.user }, error: null }) } } };
}
