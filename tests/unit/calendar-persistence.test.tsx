import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import { incidentBackend } from "../support/incident-backend";
const boundary = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => boundary.client }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let backend: ReturnType<typeof incidentBackend>;
beforeEach(() => { backend = incidentBackend(); boundary.client = backend.client; });
afterEach(cleanup);
describe("calendar persistence", () => {
  it("registers browser tools that persist and update the visible month",async()=>{
    const tools=new Map<string,{execute:(input:unknown)=>Promise<unknown>}>();
    Object.defineProperty(document,"modelContext",{configurable:true,value:{registerTool:(tool:{name:string;execute:(input:unknown)=>Promise<unknown>})=>tools.set(tool.name,tool)}});
    try {
      render(<CalendarWorkspace initialDate="2026-09-11" initialIncidents={[]} permissions={backend.state.flags}/>);
      expect(tools.size).toBe(2);
      let result:unknown;
      await act(async()=>{result=await tools.get("register_incident")!.execute({date:"2026-10-02",kind:"partial",startTime:"10:00",endTime:"10:20",note:"Tool-created"});});
      expect(result).toMatchObject({ok:true,viewRefreshed:true});
      expect(backend.state.rows).toHaveLength(1);
      expect(screen.getByLabelText("2 de outubro, 1 interrupção, 20 minutos")).toBeInTheDocument();
      expect(screen.getByText(/Em outubro, o F1 apresentou falha/)).toBeInTheDocument();
    }finally{delete (document as Document&{modelContext?:unknown}).modelContext;}
  });
  it("hides the global create control without server-granted permission", () => {
    render(<CalendarWorkspace initialDate="2026-09-11" initialIncidents={[]} permissions={{ ...backend.state.flags, can_create: false }} />);
    expect(screen.queryByRole("button", { name: "Registrar ocorrência" })).not.toBeInTheDocument();
  });
  it("preserves the typed draft and current metrics when persistence fails", async () => {
    backend.state.error = { code: "42501", message: "secret" };
    render(<CalendarWorkspace initialDate="2026-09-11" initialIncidents={[]} permissions={backend.state.flags} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar ocorrência" }));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "10:20" } });
    fireEvent.change(screen.getByLabelText("Anotação"), { target: { value: "Meu rascunho" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ocorrência" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("permissão");
    expect(screen.getByLabelText("Anotação")).toHaveValue("Meu rascunho");
    expect(screen.getByLabelText("11 de setembro, sem ocorrência registrada")).toBeInTheDocument();
    expect(backend.state.rows).toEqual([]);
  });
  it("loads the next month from persistence and refreshes its summary", async () => {
    backend.state.rows = [{ id: "33333333-3333-4333-8333-333333333333", incident_date: "2026-10-02", kind: "full_day", start_time: null, end_time: null, note: "Outubro", author_id: backend.state.user!.id }];
    render(<CalendarWorkspace initialDate="2026-09-11" initialIncidents={[]} permissions={backend.state.flags} />);
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(await screen.findByLabelText("2 de outubro, indisponível durante todo o dia")).toBeInTheDocument();
    expect(screen.getByText(/Em outubro, o F1 apresentou falha/)).toBeInTheDocument();
  });
  it("shows a retry state instead of reporting a failed month as 100% available", () => {
    render(<CalendarWorkspace initialDate="2026-09-11" initialIncidents={[]} permissions={backend.state.flags} initialError="Não foi possível carregar." />);
    expect(screen.getByRole("alert")).toHaveTextContent("carregar");
    expect(screen.queryByText("Em setembro, o F1 não apresentou falhas.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
  it("retries the requested month after a navigation failure", async () => {
    backend.state.error = { code: "network", message: "offline" };
    render(<CalendarWorkspace initialDate="2026-09-11" initialIncidents={[]} permissions={backend.state.flags} />);
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    await screen.findByRole("alert");
    backend.state.error = null;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("heading", { name: "outubro 2026" })).toBeInTheDocument();
  });
});
