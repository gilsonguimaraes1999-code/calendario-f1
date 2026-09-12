"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AuthState } from "@/features/auth/schemas";

export function AuthField({ name, label, type = "text", autoComplete, errors, minLength }: { name: string; label: string; type?: string; autoComplete?: string; errors?: string[]; minLength?: number }) {
  const [visible, setVisible] = useState(false);
  return <div className="auth-field"><label htmlFor={name}>{label}</label><div className="auth-input-wrap"><input id={name} name={name} type={type === "password" && visible ? "text" : type} autoComplete={autoComplete} required minLength={minLength} maxLength={type === "password" ? 128 : name === "full_name" ? 200 : 254} aria-invalid={errors?.length ? true : undefined} aria-describedby={errors?.length ? `${name}-error` : undefined} />{type === "password" && <button type="button" className="auth-reveal" aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}</div>{errors?.map((error, index) => <p className="auth-field-error" id={index === 0 ? `${name}-error` : undefined} key={error}>{error}</p>)}</div>;
}
export function AuthMessage({ state }: { state: AuthState }) {
  if (!state.message) return null;
  return <p role={state.ok ? "status" : "alert"} className={state.ok ? "auth-success" : "form-error"}>{state.message}</p>;
}
