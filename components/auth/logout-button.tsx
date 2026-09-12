"use client";
import { useActionState } from "react";
import { logout } from "@/features/auth/actions";
import { AuthMessage } from "./auth-fields";

export function LogoutButton() {
  const [state, action, pending] = useActionState(logout, { ok: false, message: "" });
  return <form action={action}><button className="button-quiet" disabled={pending}>{pending ? "Saindo…" : "Sair"}</button><AuthMessage state={state} /></form>;
}
