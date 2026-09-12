import { getAppOrigin } from "@/lib/env";
import type { UserResult } from "./schemas";
export function userResponse<T>(result: UserResult<T>) {
  const status = result.ok ? 200 : ({ validation: 400, unauthenticated: 401, forbidden: 403, protected: 409, not_found: 404, unavailable: 503 } as const)[result.code];
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
export function rejectUnsafeOrigin(request: Request) {
  const expected = getAppOrigin() ?? new URL(request.url).origin;
  if (request.headers.get("origin") !== expected) return userResponse({ ok: false, code: "forbidden", message: "Origem inválida. Reabra o painel para continuar." });
}
