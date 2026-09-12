"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, updatePassword } from "@/features/auth/actions";
import type { AuthState } from "@/features/auth/schemas";
import { AuthField, AuthMessage } from "./auth-fields";

export function PasswordForm({ mode }: { mode: "request" | "update" }) {
  const [state, action, pending] = useActionState(async (_previous: AuthState, data: FormData) => mode === "request" ? requestPasswordReset(data) : updatePassword(data), { ok: false, message: "" });
  return <form action={action} className="auth-form" aria-label={mode === "request" ? "Recuperar senha" : "Redefinir senha"}>{!state.ok && (mode === "request" ? <AuthField name="email" label="E-mail" type="email" autoComplete="email" errors={state.fieldErrors?.email} /> : <><AuthField name="password" label="Nova senha" type="password" autoComplete="new-password" minLength={8} errors={state.fieldErrors?.password} /><AuthField name="confirm_password" label="Confirmar senha" type="password" autoComplete="new-password" minLength={8} errors={state.fieldErrors?.confirm_password} /></>)}<AuthMessage state={state} />{!state.ok && <button className="button-gold auth-submit" disabled={pending}>{pending ? "Aguarde…" : mode === "request" ? "Enviar link de recuperação" : "Atualizar senha"}</button>}{mode === "update" && !state.ok && <Link className="auth-back" href="/forgot-password">Solicitar novo link</Link>}<Link className="auth-back" href="/login">Voltar para o login</Link></form>;
}
