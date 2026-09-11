"use client";
import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/features/auth/actions";
import type { AuthState } from "@/features/auth/schemas";
import { AuthField, AuthMessage } from "./auth-fields";

export function LoginForm() {
  const [state, action, pending] = useActionState(async (_previous: AuthState, data: FormData) => login(data), { ok: false, message: "" });
  return <><form action={action} className="auth-form" aria-label="Entrar no Calendário F1"><AuthField name="email" label="E-mail" type="email" autoComplete="username" errors={state.fieldErrors?.email} /><AuthField name="password" label="Senha" type="password" autoComplete="current-password" errors={state.fieldErrors?.password} /><AuthMessage state={state} /><button className="button-gold auth-submit" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button><Link className="auth-forgot" href="/forgot-password">Esqueci minha senha</Link></form><Link className="auth-secondary" href="/register">Solicitar novo acesso</Link></>;
}
