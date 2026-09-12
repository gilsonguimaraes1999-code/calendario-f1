"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Clock3, CircleAlert } from "lucide-react";
import type { Incident } from "@/features/incidents/types";
import { incidentInputSchema } from "@/features/incidents/schemas";
import { calculateDurationMinutes } from "@/features/incidents/metrics";

export type IncidentInput = Omit<Incident, "id" | "authorId">;
type IncidentFormProps = {
  date: string;
  incident?: Incident;
  onSave: (input: IncidentInput) => void | Promise<void>;
  onCancel: () => void;
};

export function IncidentForm({ date, incident, onSave, onCancel }: IncidentFormProps) {
  const id = useId();
  const [kind, setKind] = useState<Incident["kind"]>(incident?.kind ?? "partial");
  const [startTime, setStartTime] = useState(incident?.startTime ?? "");
  const [endTime, setEndTime] = useState(incident?.endTime ?? "");
  const [note, setNote] = useState(incident?.note ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  let duration = 0;
  try { duration = calculateDurationMinutes(startTime, endTime); } catch { /* Incomplete fields have no duration yet. */ }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const parsed = incidentInputSchema.safeParse({ date, kind, startTime: kind === "full_day" ? null : startTime, endTime: kind === "full_day" ? null : endTime, note });
    if (!parsed.success) { setError([...new Set(parsed.error.issues.map((issue) => issue.message))].join(". ")); return; }
    inFlight.current = true; setPending(true); setError("");
    try { await onSave(parsed.data); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a ocorrência. Tente novamente."); }
    finally { inFlight.current = false; setPending(false); }
  }

  return (
    <form className="incident-form" onSubmit={submit} noValidate>
      <fieldset className="incident-form-fields" disabled={pending}>
      <h3>{incident ? "Editar ocorrência" : "Nova ocorrência"}</h3>
      <fieldset className="incident-kind" disabled={pending}><legend>Tipo de indisponibilidade</legend>
        <label data-selected={kind === "partial"}><input type="radio" name={`${id}-kind`} value="partial" checked={kind === "partial"} onChange={() => { setKind("partial"); setError(""); }} /><Clock3 size={17} aria-hidden="true" />Parcial</label>
        <label data-selected={kind === "full_day"}><input type="radio" name={`${id}-kind`} value="full_day" checked={kind === "full_day"} onChange={() => { setKind("full_day"); setError(""); }} /><CircleAlert size={17} aria-hidden="true" />Dia inteiro</label>
      </fieldset>
      {kind === "partial" ? <>
        <div className="incident-times"><label htmlFor={`${id}-start`}>Início<input id={`${id}-start`} type="text" inputMode="text" placeholder="09:00" maxLength={5} value={startTime} aria-describedby={`${id}-time-help`} onChange={(event) => setStartTime(event.target.value)} /></label><label htmlFor={`${id}-end`}>Fim<input id={`${id}-end`} type="text" inputMode="text" placeholder="09:20" maxLength={5} value={endTime} aria-describedby={`${id}-time-help`} onChange={(event) => setEndTime(event.target.value)} /></label></div>
        <p className="field-help" id={`${id}-time-help`}>Horários do mesmo dia, no formato HH:MM (24h).</p>
        {duration > 0 && <p className="duration-preview"><Clock3 size={14} aria-hidden="true" />{duration} minutos de indisponibilidade</p>}
      </> : <p className="full-day-notice">O dia será considerado totalmente indisponível: 24 horas.</p>}
      <label className="note-field" htmlFor={`${id}-note`}><span>Anotação <span className="field-optional">(opcional)</span></span><textarea id={`${id}-note`} aria-label="Anotação" rows={4} placeholder="Se quiser, descreva o que aconteceu com o F1…" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="button-quiet" type="button" disabled={pending} onClick={onCancel}>Cancelar</button><button className="button-gold" type="submit" disabled={pending}>{pending ? "Salvando…" : incident ? "Salvar alterações" : "Salvar ocorrência"}</button></div>
      </fieldset>
    </form>
  );
}

