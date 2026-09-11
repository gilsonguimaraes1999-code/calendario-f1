"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

export function createBrowserSupabaseClient() {
  const env = getPublicEnv();
  return env ? createBrowserClient(env.url, env.key) : null;
}
