import { z } from "zod";

const httpUrl = z.string().url().refine((value) => /^https?:\/\//.test(value));
const publicSchema = z.object({ url: httpUrl, key: z.string().trim().min(1) });

// Read lazily so public auth pages can render before a Supabase project exists.
export function getPublicEnv() {
  const result = publicSchema.safeParse({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
  return result.success ? result.data : null;
}

export function getAppOrigin() {
  const result = httpUrl.safeParse(process.env.APP_URL);
  return result.success ? new URL(result.data).origin : null;
}
