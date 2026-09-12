"use server";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/env";
import { getAccessContext } from "./guards";
import { loginSchema, registerSchema, resetRequestSchema, updatePasswordSchema, type AuthState } from "./schemas";

const unconfigured: AuthState = { ok: false, message: "O acesso ainda não está configurado. Tente novamente mais tarde ou fale com o administrador." };
const unavailable: AuthState = { ok: false, message: "Não foi possível concluir agora. Tente novamente em instantes." };

export async function login(formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Confira os campos informados.", fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const client = await createServerSupabaseClient();
    if (!client) return unconfigured;
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error) return { ok: false, message: "Não foi possível entrar. Confira e-mail, senha e a confirmação do seu e-mail." };
  } catch { return unavailable; }
  const context = await getAccessContext();
  if (!context) return unavailable;
  redirect(context.access === "allow" ? "/calendar" : "/pending");
}

export async function register(formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Confira os campos informados.", fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const client = await createServerSupabaseClient();
    const origin = getAppOrigin();
    if (!client || !origin) return unconfigured;
    const { full_name, email, password } = parsed.data;
    const { error } = await client.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: `${origin}/auth/callback` } });
    if (error) return { ok: false, message: "Não foi possível solicitar o acesso. Tente novamente ou recupere a senha se já tiver uma conta." };
    // The database trigger atomically provisions pending/member and denied flags.
    return { ok: true, message: "Solicitação recebida. Confira seu e-mail para confirmar o cadastro e aguarde a aprovação do administrador." };
  } catch { return unavailable; }
}

export async function requestPasswordReset(formData: FormData): Promise<AuthState> {
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Informe um e-mail válido.", fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const client = await createServerSupabaseClient();
    const origin = getAppOrigin();
    if (!client || !origin) return unconfigured;
    await client.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin}/auth/callback?next=reset-password` });
    return { ok: true, message: "Se houver uma conta para este e-mail, você receberá um link para redefinir a senha. Confira também o spam." };
  } catch { return unavailable; }
}

export async function updatePassword(formData: FormData): Promise<AuthState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Confira a nova senha.", fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const client = await createServerSupabaseClient();
    if (!client) return unconfigured;
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { ok: false, message: "Este link expirou ou é inválido. Solicite um novo link de recuperação." };
    const result = await client.auth.updateUser({ password: parsed.data.password });
    if (result.error) return { ok: false, message: "Não foi possível atualizar a senha. Tente outra senha ou solicite um novo link." };
    return { ok: true, message: "Senha atualizada. Você já pode entrar com a nova senha." };
  } catch { return unavailable; }
}

export async function logout(): Promise<AuthState> {
  try {
    const client = await createServerSupabaseClient();
    if (client) { const { error } = await client.auth.signOut({ scope: "local" }); if (error) return unavailable; }
  } catch { return unavailable; }
  redirect("/login");
}
