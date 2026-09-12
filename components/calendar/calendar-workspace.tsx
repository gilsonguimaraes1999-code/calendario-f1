"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { registerCalendarTools, type ModelContext } from "@/features/webmcp/client";
import { executeCalendarTool } from "@/features/webmcp/service";
import type { CalendarToolName } from "@/features/webmcp/tools";
import { ArrowUpRight, FileText, Plus, Sparkles } from "lucide-react";
import type { Incident } from "@/features/incidents/types";
import { aggregateMonth } from "@/features/incidents/metrics";
import { buildMonthlySummary } from "@/features/incidents/summary";
import { MonthMetrics } from "@/components/metrics/month-metrics";
import { MonthCalendar } from "./month-calendar";
import { DayPanel } from "./day-panel";
import type { IncidentInput } from "./incident-form";
import type { Permissions } from "@/features/auth/guards";
import { createIncident, updateIncident, deleteIncident, listIncidentsForMonth } from "@/features/incidents/actions";
import { monthSchema } from "@/features/incidents/schemas";

export function CalendarWorkspace({ initialDate, initialIncidents, permissions, initialMonth = initialDate.slice(0, 7), initialError = "" }: { initialDate: string; initialIncidents: Incident[]; permissions: Permissions; initialMonth?: string; initialError?: string }) {
  const [year, setYear] = useState(Number(initialMonth.slice(0, 4)));
  const [month, setMonth] = useState(Number(initialMonth.slice(5, 7)));
  const [incidents, setIncidents] = useState(initialIncidents);
  const [flags, setFlags] = useState(permissions);
  const [loadError, setLoadError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  useEffect(() => setFlags(permissions), [permissions]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [startInCreate, setStartInCreate] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const metrics = aggregateMonth(incidents, year, month);
  const summary = buildMonthlySummary(metrics);
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const toolBusy = useRef(false);
  const toolExecute = useRef(runTool);
  toolExecute.current = runTool;
  useEffect(() => registerCalendarTools((document as Document & { modelContext?: ModelContext }).modelContext, (tool,input) => toolExecute.current(tool,input)), []);

  async function runTool(tool: CalendarToolName, input: unknown) {
    if (toolBusy.current || loading || panelOpen) return { ok:false, code:"unavailable", message:"Conclua o formulário aberto ou aguarde a consulta atual antes de usar a ferramenta." };
    toolBusy.current=true;
    flushSync(()=>setLoading(true));
    try {
      const result=await executeCalendarTool(tool,input);
      if(!result.ok)return result;
      const isCreation="incident" in result;
      const view=isCreation ? await executeCalendarTool("consult_calendar_month",{year:Number(result.incident.date.slice(0,4)),month:Number(result.incident.date.slice(5,7))}) : result;
      flushSync(()=>{
        setPanelOpen(false);setSelectedDate(null);
        if(view.ok && "incidents" in view) { setYear(view.metrics.year);setMonth(view.metrics.month);setIncidents(view.incidents);setFlags(view.permissions);setLoadError(""); }
        else { if(isCreation){setYear(Number(result.incident.date.slice(0,4)));setMonth(Number(result.incident.date.slice(5,7)));}setLoadError("Registro salvo, mas não foi possível atualizar o mês. Use Tentar novamente; não registre outra vez."); }
        if(isCreation)setNotice("Ocorrência registrada.");
      });
      return isCreation ? {...result,viewRefreshed:view.ok} : result;
    } catch { return {ok:false,code:"unavailable",message:"Não foi possível confirmar a operação. Consulte o mês antes de tentar registrar novamente."}; }
    finally { toolBusy.current=false;flushSync(()=>setLoading(false)); }
  }

  function selectDay(date: string, create = false) { setSelectedDate(date); setStartInCreate(create); setPanelOpen(true); }
  async function saveIncident(input: IncidentInput, id?: string) {
    const existing = incidents.filter((item) => item.date === input.date && item.id !== id);
    if (input.kind === "full_day" && existing.some((item) => item.kind === "partial")) throw new Error("Este dia já tem ocorrências parciais. Exclua-as antes de registrar um dia inteiro.");
    if (existing.some((item) => item.kind === "full_day")) throw new Error("Este dia já está marcado como indisponível durante todo o dia. Edite ou exclua esse registro primeiro.");
    const result = id ? await updateIncident(id, input) : await createIncident(input);
    if (!result.ok) throw new Error(result.message);
    const next = result.incident;
    setIncidents((current) => id ? current.map((item) => item.id === id ? next : item) : [...current, next]);
    setNotice(id ? "Ocorrência atualizada." : "Ocorrência registrada.");
  }
  async function removeIncident(id: string) {
    const result = await deleteIncident(id);
    if (!result.ok) throw new Error(result.message);
    setIncidents((current) => current.filter((item) => item.id !== result.id));
    setNotice("Ocorrência excluída.");
  }
  async function loadMonth(nextYear: number, nextMonth: number) {
    if (loading) return;
    if (!monthSchema.safeParse({ year: nextYear, month: nextMonth }).success) { setNotice("Escolha um mês entre 1900 e 9999."); return; }
    setYear(nextYear); setMonth(nextMonth); setNotice("");
    setLoading(true); setLoadError(""); setPanelOpen(false); setSelectedDate(null);
    try {
      const result = await listIncidentsForMonth(nextYear, nextMonth);
      if (!result.ok) { setLoadError(result.message); return; }
      setYear(nextYear); setMonth(nextMonth); setIncidents(result.incidents); setFlags(result.permissions);
    } catch { setLoadError("Não foi possível carregar o mês. Tente novamente."); }
    finally { setLoading(false); }
  }

  return (
    <main className="calendar-workspace">
      <div className="workspace-heading"><div><div className="eyebrow workspace-eyebrow"><span className="status-dot status-dot--gold" />Monitoramento do F1</div><h1>Cada dia conta.</h1><p>Acompanhe as interrupções. Entenda o impacto do mês.</p></div>{flags.can_create && !loadError && !loading && <button type="button" className="button-gold register-button" onClick={() => {
        const currentMonth = `${year}-${String(month).padStart(2, "0")}`;
        selectDay(selectedDate?.startsWith(currentMonth) ? selectedDate : initialDate.startsWith(currentMonth) ? initialDate : `${currentMonth}-01`, true);
      }}><Plus size={18} />Registrar ocorrência</button>}</div>
      {loading ? <p role="status">Carregando ocorrências…</p> : loadError ? <section className="panel"><p className="form-error" role="alert">{loadError}</p><button className="button-quiet" onClick={() => loadMonth(year, month)}>Tentar novamente</button></section> : <><MonthMetrics metrics={metrics} />
      <div className="workspace-content"><MonthCalendar year={year} month={month} incidents={incidents} today={initialDate} onSelectDay={(date) => selectDay(date)} onChangeMonth={loadMonth} />
        <aside className="month-insights">
          <section className="month-summary panel"><div className="insight-title"><FileText size={18} /><span className="eyebrow">Resumo do mês</span></div><h2>O retrato de <span>{monthName}.</span></h2><p className="month-summary__text" aria-live="polite">{summary}</p><div className="summary-availability"><span>Disponibilidade no mês</span><strong>{metrics.availabilityPercent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</strong><div className="availability-track" aria-hidden="true"><span style={{ width: `${metrics.availabilityPercent}%` }} /></div></div><p className="summary-footnote"><Sparkles size={13} />Resumo atualizado a cada registro</p></section>
          <section className="calendar-tip"><ArrowUpRight size={21} /><h3>O detalhe faz a diferença.</h3><p>Clique em um dia para consultar anotações, registrar intervalos ou marcar a indisponibilidade total.</p></section>
        </aside>
      </div></>}
      <footer className="workspace-footer"><span><i className="status-dot status-dot--gold" />{flags.can_view_all ? "Todas as ocorrências do F1" : "Minhas ocorrências do F1"}</span><button className="button-quiet" disabled={loading} onClick={() => loadMonth(year, month)}>Atualizar mês</button></footer>
      {notice && <p className="workspace-notice" role="status">{notice}</p>}
      {panelOpen && selectedDate && <DayPanel key={selectedDate} date={selectedDate} incidents={incidents} permissions={{ create: flags.can_create, edit: flags.can_edit, delete: flags.can_delete }} startInCreate={startInCreate} onSave={saveIncident} onDelete={removeIncident} onClose={() => setPanelOpen(false)} />}
    </main>
  );
}

