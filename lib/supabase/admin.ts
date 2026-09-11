import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

// Call only after authorizing the actor. This client bypasses RLS.
export function createAdminSupabaseClient() {
  const env = getPublicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!env || !key) return null;
  return createClient(env.url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
