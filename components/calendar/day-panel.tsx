"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, Clock3, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Incident } from "@/features/incidents/types";
import { calculateDurationMinutes } from "@/features/incidents/metrics";
import { IncidentForm, type IncidentInput } from "./incident-form";

export type CalendarPermissions = { create: boolean; edit: boolean; delete: boolean };
type DayPanelProps = {
  date: string;
  incidents: Incident[];
  permissions: CalendarPermissions;
  startInCreate?: boolean;
  onSave: (input: IncidentInput, id?: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onClose: () => void;
};

export function DayPanel({ date, incidents, permissions, startInCreate = false, onSave, onDelete, onClose }: DayPanelProps) {
  const [editing, setEditing] = useState<Incident | "new" | null>(startInCreate && permissions.create ? "new" : null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dayIncidents = incidents.filter((item) => item.date === date).sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);

  useEffect(() => {
    if (!panelRef.current?.contains(document.activeElement)) {
      const nextFocus = panelRef.current?.querySelector<HTMLElement>("form input:checked, .day-panel__section-title button");
      (nextFocus ?? closeRef.current)?.focus();
    }
  }, [editing, deleting, incidents]);

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.stopPropagation(); if (!busy) onClose(); }
    if (event.key !== "Tab") return;
    const elements = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
    if (!elements?.length) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <div className="day-panel-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="day-panel" role="dialog" aria-modal="true" aria-labelledby="day-panel-title" ref={panelRef} onKeyDown={keyboard}>
        <header className="day-panel__header"><div><span className="eyebrow">Registro diário</span><h2 id="day-panel-title">{dateLabel}</h2><p>{weekday}</p></div><button type="button" className="icon-button" ref={closeRef} disabled={busy} aria-label="Fechar painel do dia" onClick={onClose}><X size={20} /></button></header>
        <div className="day-panel__body">
          {editing ? <IncidentForm key={editing === "new" ? "new" : editing.id} date={date} incident={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onSave={async (input) => {
            if (editing === "new" ? !permissions.create : !permissions.edit) throw new Error("Você não tem permissão para esta ação.");
            setBusy(true);
            try { await onSave(input, editing === "new" ? undefined : editing.id); setEditing(null); }
            finally { setBusy(false); }
          }} /> : <>
            <div className="day-panel__section-title"><h3>{dayIncidents.length} {dayIncidents.length === 1 ? "ocorrência" : "ocorrências"}</h3>{permissions.create && <button type="button" className="button-quiet" onClick={() => setEditing("new")}><Plus size={15} />Adicionar ocorrência</button>}</div>
            {dayIncidents.length === 0 && <div className="day-panel__empty"><CalendarDays size={32} strokeWidth={1.3} /><h3>Nenhuma ocorrência</h3><p>Não há indisponibilidades registradas neste dia.</p>{permissions.create && <p>Use “Adicionar ocorrência” para fazer o primeiro registro.</p>}</div>}
            <div className="incident-list">{dayIncidents.map((incident) => <article key={incident.id} className="incident-card" data-kind={incident.kind}>
              <div className="incident-card__heading"><span className="incident-badge"><i className={`status-dot status-dot--${incident.kind === "full_day" ? "full" : "partial"}`} />{incident.kind === "full_day" ? "Dia inteiro" : "Interrupção parcial"}</span><div className="incident-card__actions">{permissions.edit && <button type="button" className="icon-button" aria-label="Editar ocorrência" onClick={() => setEditing(incident)}><Pencil size={15} /></button>}{permissions.delete && <button type="button" className="icon-button" aria-label="Excluir ocorrência" onClick={() => setDeleting(incident.id)}><Trash2 size={15} /></button>}</div></div>
              <div className="incident-card__time"><Clock3 size={14} />{incident.kind === "full_day" ? "24 horas de indisponibilidade" : `${incident.startTime} — ${incident.endTime} · ${calculateDurationMinutes(incident.startTime!, incident.endTime!)} min`}</div>
              {incident.note && <p>{incident.note}</p>}
              {deleting === incident.id && <div className="delete-confirmation"><p>Excluir esta ocorrência? As métricas do mês serão recalculadas.</p>{deleteError && <p className="form-error" role="alert">{deleteError}</p>}<div><button type="button" className="button-quiet" disabled={busy} onClick={() => { setDeleting(null); setDeleteError(""); }}>Manter ocorrência</button><button type="button" className="button-danger" disabled={busy} onClick={async () => {
                if (!permissions.delete || busy) return;
                setBusy(true); setDeleteError("");
                try { await onDelete(incident.id); setDeleting(null); }
                catch (cause) { setDeleteError(cause instanceof Error ? cause.message : "Não foi possível excluir. Tente novamente."); }
                finally { setBusy(false); }
              }}>{busy ? "Excluindo…" : "Confirmar exclusão"}</button></div></div>}
            </article>)}</div>
          </>}
        </div>
      </div>
    </div>
  );
}

