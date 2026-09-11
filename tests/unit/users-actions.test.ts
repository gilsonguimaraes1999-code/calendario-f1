// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { incidentBackend } from "../support/incident-backend";
const boundary = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => boundary.client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { listUsers, updateUserAccess, updateUserStatus, updateUserPermissions, deleteUser } from "@/features/users/actions";
import UsersPage from "@/app/(private)/admin/users/page";
const target = "22222222-2222-4222-8222-222222222222";
let backend: ReturnType<typeof incidentBackend>;
let rpc: ReturnType<typeof vi.fn>;
beforeEach(() => {
  backend = incidentBackend(); backend.state.flags.can_manage_users = true;
  rpc = vi.fn(async () => ({ data: [], error: null }));
  boundary.client = { ...backend.client, rpc };
});
describe("user administration through the verified Supabase boundary", () => {
  it("protects the page as well as actions", async () => {
    backend.state.flags.can_manage_users=false;
    await expect(UsersPage()).rejects.toMatchObject({digest:expect.stringContaining("/calendar")});
    boundary.client=null;
    await expect(UsersPage()).rejects.toMatchObject({digest:expect.stringContaining("/login")});
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects missing change values", async () => {
    expect(await updateUserPermissions(target,undefined)).toMatchObject({code:"validation"});
    expect(await updateUserStatus(target,undefined)).toMatchObject({code:"validation"});
    expect(rpc).not.toHaveBeenCalled();
  });
  it("denies anonymous/unconfigured sessions without calling RPC", async () => {
    boundary.client = null;
    expect(await listUsers()).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["pending", "rejected", "suspended"])("denies %s managers", async status => {
    backend.state.status = status;
    expect(await listUsers()).toMatchObject({ ok: false, code: "forbidden" });
    expect(await updateUserStatus(target, "approved")).toMatchObject({ ok: false, code: "forbidden" });
    expect(await deleteUser(target)).toMatchObject({ ok: false, code: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("denies members without manage permission", async () => {
    backend.state.flags.can_manage_users = false;
    expect(await updateUserPermissions(target, backend.state.flags)).toMatchObject({ ok: false, code: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("allows an approved manager independently of calendar permission", async () => {
    backend.state.flags.can_view = false;
    expect(await listUsers()).toEqual({ ok: true, users: [] });
    expect(rpc).toHaveBeenCalledWith("list_access_users", { page_offset: 0, page_size: 500 });
  });
  it("allows an owner even if permission flags/status are stale", async () => {
    backend.state.role = "owner"; backend.state.status = "suspended"; backend.state.flags.can_manage_users = false;
    expect(await listUsers()).toMatchObject({ ok: true });
  });
  it("strictly rejects role escalation, invalid IDs and unknown permission flags", async () => {
    expect(await updateUserAccess(target, { role: "owner" })).toMatchObject({ code: "validation" });
    expect(await deleteUser("invalid")).toMatchObject({ code: "validation" });
    expect(await updateUserPermissions(target, { ...backend.state.flags, god_mode: true })).toMatchObject({ code: "validation" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects self edits before writing", async () => {
    expect(await deleteUser(backend.state.user!.id)).toMatchObject({ code: "protected" });
    expect(await updateUserStatus(backend.state.user!.id, "suspended")).toMatchObject({ code: "protected" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["approved", "rejected", "suspended", "pending"])("supports persisted %s transitions", async status => {
    rpc.mockResolvedValue({ data: { id: target, full_name: "Ana", email: "ana@example.com", role: "member", status, permissions: backend.state.flags }, error: null });
    expect(await updateUserStatus(target, status)).toMatchObject({ ok: true, user: { status } });
    expect(rpc).toHaveBeenCalledWith("update_access_user", { target_id: target, changes: { status } });
  });
  it("saves the name, status and all six flags atomically", async () => {
    const changes = { full_name: "Ana", status: "approved", permissions: { ...backend.state.flags, can_view_all: true } };
    rpc.mockResolvedValue({ data: { id: target, email: "ana@example.com", role: "member", ...changes }, error: null });
    expect(await updateUserAccess(target, changes)).toMatchObject({ ok: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("update_access_user", { target_id: target, changes });
  });
  it("maps transactional owner protection and never exposes database errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "protected_user SECRET" } });
    expect(await deleteUser(target)).toMatchObject({ ok: false, code: "protected" });
    rpc.mockResolvedValue({ data: null, error: { code: "500", message: "SECRET" } });
    expect(JSON.stringify(await deleteUser(target))).not.toContain("SECRET");
  });
  it("only confirms deletion after the transactional RPC succeeds", async () => {
    rpc.mockResolvedValue({ data: target, error: null });
    expect(await deleteUser(target)).toEqual({ ok: true, id: target });
  });
});
