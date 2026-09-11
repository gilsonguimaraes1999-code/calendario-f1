// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAccess, requireApprovedUser, requireSession } from "@/features/auth/guards";
import { login, register, requestPasswordReset, updatePassword, logout } from "@/features/auth/actions";
import { getPublicEnv } from "@/lib/env";

const boundary = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => boundary.client }));

function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }
const credentials = { email: "person@example.test", password: "a-long-password" };
function backend(status = "approved", canView = true, role = "member") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "member-1", email: credentials.email } }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: { id: "member-1" }, session: null }, error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: { user: { id: "member-1" } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: (table: string) => ({ select: () => ({ eq: (_key: string, id: string) => ({ maybeSingle: async () => ({ data: id !== "member-1" ? null : table === "profiles" ? { id, full_name: "Person", status, role } : { can_view: canView, can_create: false, can_edit: false, can_delete: false, can_manage_users: false }, error: null }) }) }) }),
  };
}

beforeEach(() => { boundary.client = null; vi.unstubAllEnvs(); vi.stubEnv("APP_URL", "https://calendar.example.test"); });
describe("access lifecycle", () => {
  it.each([
    ["approved", true, "allow"], ["approved", false, "deny"], ["pending", true, "pending"],
    ["pending", false, "pending"], ["rejected", true, "deny"], ["suspended", true, "deny"],
  ] as const)("resolves %s with view=%s to %s", (status, can_view, expected) => expect(resolveAccess({ status, can_view })).toBe(expected));
  it("fails closed for a missing profile", () => expect(resolveAccess(null)).toBe("deny"));
  it("preserves the database owner override", () => expect(resolveAccess({ status: "suspended", role: "owner", can_view: false })).toBe("allow"));
  it("redirects an unconfigured private request to login", async () => await expect(requireApprovedUser()).rejects.toMatchObject({ digest: expect.stringContaining("/login;") }));
  it("rejects an expired session", async () => { const client = backend(); client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null }); boundary.client = client; await expect(requireSession()).rejects.toMatchObject({ digest: expect.stringContaining("/login;") }); });
  it.each(["pending", "rejected", "suspended"])("routes %s members away from the calendar", async (status) => { boundary.client = backend(status); await expect(requireApprovedUser()).rejects.toMatchObject({ digest: expect.stringContaining("/pending;") }); });
  it("returns the verified identity and flags for an approved member", async () => { boundary.client = backend(); await expect(requireApprovedUser()).resolves.toMatchObject({ user: { id: "member-1" }, profile: { status: "approved" }, permissions: { can_view: true } }); });
});
describe("server forms", () => {
  it("validates before attempting login", async () => expect(await login(form({ email: "bad", password: "" }))).toMatchObject({ ok: false, fieldErrors: { email: expect.any(Array), password: expect.any(Array) } }));
  it("returns a recoverable configuration message", async () => expect(await login(form(credentials))).toMatchObject({ ok: false, message: expect.stringMatching(/configurad/i) }));
  it.each([["approved", "/calendar;"], ["pending", "/pending;"], ["suspended", "/pending;"]])("routes a successful %s login", async (status, destination) => { boundary.client = backend(status); await expect(login(form(credentials))).rejects.toMatchObject({ digest: expect.stringContaining(destination) }); });
  it("does not expose provider errors", async () => { const client = backend(); client.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "sensitive backend detail" } }); boundary.client = client; const result = await login(form(credentials)); expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("sensitive"); });
  it("signup sends only the name as metadata, leaving pending provisioning to the database trigger", async () => { const client = backend(); boundary.client = client; const result = await register(form({ ...credentials, full_name: " Person ", confirm_password: credentials.password, role: "owner", status: "approved" })); expect(result).toMatchObject({ ok: true, message: expect.stringMatching(/aprova/i) }); expect(client.auth.signUp).toHaveBeenCalledWith({ ...credentials, options: { data: { full_name: "Person" }, emailRedirectTo: "https://calendar.example.test/auth/callback" } }); });
  it("rejects mismatched signup passwords", async () => expect(await register(form({ ...credentials, full_name: "Person", confirm_password: "different" }))).toMatchObject({ ok: false, fieldErrors: { confirm_password: expect.any(Array) } }));
  it("uses a fixed recovery destination and hides account existence", async () => { const client = backend(); client.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: { message: "User not found" } }); boundary.client = client; expect(await requestPasswordReset(form({ email: credentials.email }))).toMatchObject({ ok: true }); expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(credentials.email, { redirectTo: "https://calendar.example.test/auth/callback?next=reset-password" }); });
  it("requires a verified session for password updates", async () => { const client = backend(); client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null }); boundary.client = client; expect(await updatePassword(form({ password: credentials.password, confirm_password: credentials.password }))).toMatchObject({ ok: false, message: expect.stringMatching(/link/i) }); expect(client.auth.updateUser).not.toHaveBeenCalled(); });
  it("updates a validated password for the verified session", async () => { const client = backend(); boundary.client = client; expect(await updatePassword(form({ password: credentials.password, confirm_password: credentials.password }))).toMatchObject({ ok: true }); expect(client.auth.updateUser).toHaveBeenCalledWith({ password: credentials.password }); });
  it("clears the current session before redirecting on logout", async () => { const client = backend(); boundary.client = client; await expect(logout()).rejects.toMatchObject({ digest: expect.stringContaining("/login;") }); expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" }); });
});
describe("lazy configuration", () => {
  it("accepts missing configuration without crashing module imports", () => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""); expect(getPublicEnv()).toBeNull(); });
  it("rejects malformed service URLs", () => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key"); expect(getPublicEnv()).toBeNull(); });
});
