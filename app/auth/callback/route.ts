import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  let destination = "/login?error=callback";
  if (code) {
    try {
      const client = await createServerSupabaseClient();
      if (client) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (!error) destination = request.nextUrl.searchParams.get("next") === "reset-password" ? "/reset-password" : "/calendar";
      }
    } catch { /* Expired codes and provider failures get the same recovery path. */ }
  }
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
