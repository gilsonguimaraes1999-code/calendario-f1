// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { incidentBackend } from "../support/incident-backend";
const boundary = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => boundary.client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { GET } from "@/app/api/admin/users/route";
import { PATCH, DELETE } from "@/app/api/admin/users/[id]/route";
const id = "22222222-2222-4222-8222-222222222222";
const params = { params: Promise.resolve({ id }) };
let backend: ReturnType<typeof incidentBackend>;
let rpc: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.stubEnv("APP_URL", "http://localhost:3000"); backend = incidentBackend(); rpc = vi.fn(); boundary.client = { ...backend.client, rpc }; });
it("secures GET independently of page guards", async () => {
  expect((await GET()).status).toBe(403); boundary.client=null;
  expect((await GET()).status).toBe(401); expect(rpc).not.toHaveBeenCalled();
});
it.each([null,"https://evil.example","null"])("rejects unsafe write origin %s", async origin => {
  backend.state.flags.can_manage_users=true;
  const headers: Record<string,string> = origin ? { Origin: origin } : {};
  expect((await DELETE(new Request("http://localhost:3000/api/admin/users/"+id, { method:"DELETE", headers }),params)).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
it("rejects malformed JSON without leaking details", async () => {
  const response = await PATCH(new Request("http://localhost:3000/api/admin/users/"+id, { method:"PATCH", headers:{Origin:"http://localhost:3000"},body:"{" }),params);
  expect(response.status).toBe(400); expect(rpc).not.toHaveBeenCalled();
});
it("valid same-origin request still requires management permission", async () => {
  const response = await DELETE(new Request("http://localhost:3000/api/admin/users/"+id, { method:"DELETE", headers:{Origin:"http://localhost:3000"} }),params);
  expect(response.status).toBe(403); expect(rpc).not.toHaveBeenCalled();
});
it("authorized same-origin deletion returns no-store result", async () => {
  backend.state.flags.can_manage_users=true; rpc.mockResolvedValue({data:id,error:null});
  const response = await DELETE(new Request("http://localhost:3000/api/admin/users/"+id, { method:"DELETE", headers:{Origin:"http://localhost:3000"} }),params);
  expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ok:true,id});
});
