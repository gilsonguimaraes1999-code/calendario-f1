"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { ManagedUser } from "@/features/users/schemas";
export const statusLabels = { pending: "Pendente", approved: "Aprovada", rejected: "Rejeitada", suspended: "Suspensa" };
type Status = ManagedUser["status"];
const statuses = Object.keys(statusLabels) as Status[];
export function AccountStatusSelect({ value, onChange, disabled }: { value: Status; onChange: (value: Status) => void; disabled?: boolean }) {
  const [open,setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const id=useId();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown",outside); return () => document.removeEventListener("pointerdown",outside);
  },[open]);
  return <div className="users-status-select" ref={root} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    if (event.key === "Tab") setOpen(false);
    if (!["ArrowDown","ArrowUp","Home","End"].includes(event.key)) return;
    event.preventDefault(); if (!open) { setOpen(true); return; }
    const options=Array.from(root.current!.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const index=options.indexOf(document.activeElement as HTMLButtonElement);
    options[event.key==="Home" ? 0 : event.key==="End" ? options.length-1 : (index+(event.key==="ArrowDown" ? 1 : -1)+options.length)%options.length]?.focus();
  }}>
    <button ref={trigger} type="button" className="users-field users-status-trigger" disabled={disabled} aria-label={`Status da conta: ${statusLabels[value]}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} onClick={() => setOpen(!open)}><span className={`status-badge status-${value}`}>{statusLabels[value]}</span><ChevronDown size={16}/></button>
    {open && !disabled && <div id={id} role="listbox" aria-label="Status da conta" className="users-status-options">{statuses.map(status => <button type="button" role="option" aria-selected={status===value} key={status} onClick={() => { onChange(status); setOpen(false); trigger.current?.focus(); }}><span className="users-check" data-checked={status===value}>{status===value&&<Check size={12}/>}</span>{statusLabels[status]}</button>)}</div>}
  </div>;
}
