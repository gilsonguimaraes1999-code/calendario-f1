import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import type { Incident } from "@/features/incidents/types";
import { incidentBackend } from "../support/incident-backend";
const boundary = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => boundary.client }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let backend: ReturnType<typeof incidentBackend>;
beforeEach(() => { backend = incidentBackend(); boundary.client = backend.client; });

afterEach(cleanup);
const fixtures: Incident[] = [
  { id: "partial", date: "2026-09-02", kind: "partial", startTime: "10:00", endTime: "10:20", note: "Conexão interrompida", authorId: "preview" },
  { id: "full", date: "2026-09-03", kind: "full_day", startTime: null, endTime: null, note: "Indisponibilidade total", authorId: "preview" },
];

describe("MonthCalendar", () => {
  it("exposes distinct day states and selects the operational date", () => {
    const selectDay = vi.fn();
    render(<MonthCalendar year={2026} month={9} incidents={fixtures} onSelectDay={selectDay} />);
    expect(screen.getByLabelText("3 de setembro, indisponível durante todo o dia")).toHaveAttribute("data-state", "full-day");
    const day = screen.getByLabelText("2 de setembro, 1 interrupção, 20 minutos");
    expect(day).toHaveAttribute("data-state", "partial");
    fireEvent.click(day);
    expect(selectDay).toHaveBeenCalledWith("2026-09-02");
    expect(screen.getAllByRole("button", { name: /de setembro,/ })).toHaveLength(30);
  });

  it("combines overlapping incidents without inflating minutes and exposes multiple notes", () => {
    render(<MonthCalendar year={2026} month={9} incidents={[...fixtures, { ...fixtures[0], id: "second", startTime: "10:10", endTime: "10:30" }]} onSelectDay={() => {}} />);
    const day = screen.getByLabelText("2 de setembro, 2 interrupções, 30 minutos");
    expect(within(day).getByLabelText("2 anotações")).toBeInTheDocument();
  });

  it("navigates across years and returns to the current month", () => {
    const changeMonth = vi.fn();
    render(<MonthCalendar year={2026} month={12} incidents={[]} onSelectDay={() => {}} onChangeMonth={changeMonth} today="2026-09-11" />);
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(changeMonth).toHaveBeenLastCalledWith(2027, 1);
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(changeMonth).toHaveBeenLastCalledWith(2026, 11);
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(changeMonth).toHaveBeenLastCalledWith(2026, 9);
  });
});

describe("CalendarWorkspace", () => {
  it("remembers the operational day for registration without leaving a pressed selection marker", () => {
    render(<CalendarWorkspace initialDate="2026-09-11" initialIncidents={fixtures} permissions={backend.state.flags} />);
    const day = screen.getByLabelText("2 de setembro, 1 interrupção, 20 minutos");
    fireEvent.click(day);
    fireEvent.click(screen.getByRole("button", { name: "Fechar painel do dia" }));
    expect(day).not.toHaveAttribute("aria-pressed");
    fireEvent.click(screen.getByRole("button", { name: "Registrar ocorrência" }));
    expect(screen.getByRole("dialog", { name: "2 de setembro" })).toBeInTheDocument();
    expect(screen.getByLabelText("Anotação")).toBeInTheDocument();
  });

  it("updates calendar, metrics and summary after creating, editing and confirming deletion", async () => {
    render(<CalendarWorkspace initialDate="2026-09-11" initialIncidents={[]} permissions={backend.state.flags} />);
    fireEvent.click(screen.getByLabelText("2 de setembro, sem ocorrência registrada"));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ocorrência" }));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "10:20" } });
    fireEvent.change(screen.getByLabelText("Anotação"), { target: { value: "Conexão interrompida" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ocorrência" }));
    expect(await screen.findByText("Conexão interrompida", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByLabelText("2 de setembro, 1 interrupção, 20 minutos")).toBeInTheDocument();
    expect(screen.getByText(/Em setembro, o F1 apresentou falha em 1 dia/)).toHaveTextContent("20 min");
    fireEvent.click(screen.getByRole("button", { name: "Editar ocorrência" }));
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "10:40" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByLabelText("2 de setembro, 1 interrupção, 40 minutos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir ocorrência" }));
    expect(screen.getByText("Conexão interrompida")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    expect(await screen.findByLabelText("2 de setembro, sem ocorrência registrada")).toBeInTheDocument();
    expect(screen.getByText("Em setembro, o F1 não apresentou falhas.")).toBeInTheDocument();
    expect(backend.state.rows).toEqual([]);
  });

  it("registers on the selected date and prevents partial/full-day conflicts", async () => {
    render(<CalendarWorkspace initialDate="2026-09-11" initialIncidents={fixtures} permissions={backend.state.flags} />);
    fireEvent.click(screen.getByLabelText("2 de setembro, 1 interrupção, 20 minutos"));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ocorrência" }));
    fireEvent.click(screen.getByRole("radio", { name: "Dia inteiro" }));
    fireEvent.change(screen.getByLabelText("Anotação"), { target: { value: "Dia inteiro" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ocorrência" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ocorrências parciais");
    expect(screen.getByLabelText("Anotação")).toHaveValue("Dia inteiro");
  });
});
