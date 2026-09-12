import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IncidentForm } from "@/components/calendar/incident-form";
import { DayPanel } from "@/components/calendar/day-panel";
import type { Incident } from "@/features/incidents/types";

afterEach(cleanup);
const incident: Incident = { id: "1", date: "2026-09-02", kind: "partial", startTime: "10:00", endTime: "10:20", note: "Falha de conexão", authorId: "preview" };

describe("IncidentForm", () => {
  it("locks the submitted fields while awaiting persistence", () => {
    render(<IncidentForm date="2026-09-02" incident={incident} onSave={() => new Promise<void>(() => {})} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(screen.getByLabelText("Anotação")).toBeDisabled();
    expect(screen.getByLabelText("Início")).toBeDisabled();
  });
  it("awaits server confirmation and preserves the draft on asynchronous failure", async () => {
    render(<IncidentForm date="2026-09-02" incident={incident} onSave={async () => { throw new Error("Falha ao persistir"); }} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao persistir");
    expect(screen.getByLabelText("Anotação")).toHaveValue("Falha de conexão");
  });
  it.each(["Início", "Fim"])("keeps %s text-capable so mobile users can enter the HH:MM colon", (label) => {
    render(<IncidentForm date="2026-09-02" onSave={() => {}} onCancel={() => {}} />);
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "text");
  });

  it("allows an empty note and still requires ordered times for a partial incident", async () => {
    const save = vi.fn();
    render(<IncidentForm date="2026-09-02" onSave={save} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "10:20" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "10:40" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ocorrência" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ date: "2026-09-02", kind: "partial", startTime: "10:20", endTime: "10:40", note: "" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar ocorrência" })).toBeEnabled());
    save.mockClear();
    fireEvent.change(screen.getByLabelText("Anotação"), { target: { value: "  Falha de conexão  " } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ocorrência" }));
    expect(screen.getByRole("alert")).toHaveTextContent("O horário final deve ser posterior ao inicial");
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "10:40" } });
    expect(screen.getByText("20 minutos de indisponibilidade")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar ocorrência" }));
    expect(save).toHaveBeenCalledWith({ date: "2026-09-02", kind: "partial", startTime: "10:20", endTime: "10:40", note: "Falha de conexão" });
  });

  it("hides and nulls times for a full day while allowing no note", async () => {
    const save = vi.fn();
    render(<IncidentForm date="2026-09-02" onSave={save} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "Dia inteiro" }));
    expect(screen.queryByLabelText("Início")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fim")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar ocorrência" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ date: "2026-09-02", kind: "full_day", startTime: null, endTime: null, note: "" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar ocorrência" })).toBeEnabled());
    save.mockClear();
    fireEvent.change(screen.getByLabelText("Anotação"), { target: { value: "Manutenção" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ocorrência" }));
    expect(save).toHaveBeenCalledWith({ date: "2026-09-02", kind: "full_day", startTime: null, endTime: null, note: "Manutenção" });
  });

  it("prefills an existing incident for editing", () => {
    render(<IncidentForm date="2026-09-02" incident={incident} onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText("Anotação")).toHaveValue("Falha de conexão");
    expect(screen.getByLabelText("Início")).toHaveValue("10:00");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
  });
});

describe("DayPanel", () => {
  it("keeps keyboard focus inside the panel when entering and leaving the form", () => {
    render(<DayPanel date="2026-09-02" incidents={[incident]} permissions={{ create: true, edit: true, delete: true }} onSave={() => {}} onDelete={() => {}} onClose={() => {}} />);
    const add = screen.getByRole("button", { name: "Adicionar ocorrência" });
    add.focus();
    fireEvent.click(add);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    const cancel = screen.getByRole("button", { name: "Cancelar" });
    cancel.focus();
    fireEvent.click(cancel);
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("lists each occurrence while hiding mutations without permission", () => {
    render(<DayPanel date="2026-09-02" incidents={[incident, { ...incident, id: "2", note: "Segunda interrupção" }]} permissions={{ create: false, edit: false, delete: false }} onSave={() => {}} onDelete={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Falha de conexão")).toBeInTheDocument();
    expect(screen.getByText("Segunda interrupção")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar ocorrência" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir ocorrência" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar ocorrência" })).not.toBeInTheDocument();
  });

  it("closes on Escape and can cancel deletion without removing the record", () => {
    const close = vi.fn();
    const remove = vi.fn();
    render(<DayPanel date="2026-09-02" incidents={[incident]} permissions={{ create: true, edit: true, delete: true }} onSave={() => {}} onDelete={remove} onClose={close} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir ocorrência" }));
    fireEvent.click(screen.getByRole("button", { name: "Manter ocorrência" }));
    expect(remove).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Confirmar exclusão" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(close).toHaveBeenCalled();
  });
});

