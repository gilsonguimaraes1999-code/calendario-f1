import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";

export async function createServerSupabaseClient() {
  const env = getPublicEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try { for (const { name, value, options } of values) cookieStore.set(name, value, options); }
        catch { /* Server Components cannot write cookies; proxy refreshes them. */ }
      },
    },
  });
}
