// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/callback/route";
import { proxy } from "@/proxy";

const boundary = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => boundary.client }));
beforeEach(() => { boundary.client = null; vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""); });
describe("auth callback", () => {
  it("returns to login with a recoverable expired-link message", async () => { const result = await GET(new NextRequest("https://calendar.example.test/auth/callback")); expect(result.headers.get("location")).toBe("https://calendar.example.test/login?error=callback"); });
  it("exchanges a recovery code and reaches the password form", async () => { boundary.client = { auth: { exchangeCodeForSession: async (code: string) => ({ error: code === "valid" ? null : new Error("invalid") }) } }; const result = await GET(new NextRequest("https://calendar.example.test/auth/callback?code=valid&next=reset-password")); expect(result.headers.get("location")).toBe("https://calendar.example.test/reset-password"); });
  it("never redirects to a user-supplied external URL", async () => { boundary.client = { auth: { exchangeCodeForSession: async () => ({ error: null }) } }; const result = await GET(new NextRequest("https://calendar.example.test/auth/callback?code=valid&next=https://evil.example")); expect(result.headers.get("location")).toBe("https://calendar.example.test/calendar"); });
});
describe("unconfigured proxy", () => {
  it("keeps the login page available", async () => expect((await proxy(new NextRequest("https://calendar.example.test/login"))).status).toBe(200));
  it("redirects private calendar requests to login", async () => expect((await proxy(new NextRequest("https://calendar.example.test/calendar"))).headers.get("location")).toBe("https://calendar.example.test/login"));
});
