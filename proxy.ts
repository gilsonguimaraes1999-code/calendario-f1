import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

export async function proxy(request: NextRequest) {
  const privatePath = /^\/(calendar|pending|admin)(\/|$)/.test(request.nextUrl.pathname);
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  let authenticated = false;
  if (env) {
    const client = createServerClient(env.url, env.key, { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values, headers) => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      },
    } });
    try { const { data, error } = await client.auth.getUser(); authenticated = !error && !!data.user; }
    catch { /* Authorization fails closed; public recovery pages remain usable. */ }
  }
  if (privatePath && !authenticated) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
    response = redirectResponse;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/calendar/:path*", "/pending", "/admin/:path*", "/login", "/register", "/forgot-password", "/reset-password", "/auth/callback"] };
