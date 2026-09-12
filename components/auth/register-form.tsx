"use client";
import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/features/auth/actions";
import type { AuthState } from "@/features/auth/schemas";
import { AuthField, AuthMessage } from "./auth-fields";

export function RegisterForm() {
  const [state, action, pending] = useActionState(async (_previous: AuthState, data: FormData) => register(data), { ok: false, message: "" });
  return <form action={action} className="auth-form" aria-label="Solicitar acesso">{!state.ok && <><AuthField name="full_name" label="Nome completo" autoComplete="name" errors={state.fieldErrors?.full_name} /><AuthField name="email" label="E-mail" type="email" autoComplete="email" errors={state.fieldErrors?.email} /><AuthField name="password" label="Senha" type="password" autoComplete="new-password" minLength={8} errors={state.fieldErrors?.password} /><AuthField name="confirm_password" label="Confirmar senha" type="password" autoComplete="new-password" minLength={8} errors={state.fieldErrors?.confirm_password} /><p className="auth-help">Use pelo menos 8 caracteres. O acesso depende da aprovação do administrador.</p></>}<AuthMessage state={state} />{!state.ok && <button className="button-gold auth-submit" disabled={pending}>{pending ? "Enviando…" : "Solicitar acesso"}</button>}<Link className="auth-back" href="/login">Voltar para o login</Link></form>;
}
