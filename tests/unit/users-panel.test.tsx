import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UsersPanel } from "@/components/users/users-panel";
import type { ManagedUser } from "@/features/users/schemas";
const flags = { can_view: true, can_view_all: false, can_create: false, can_edit: false, can_delete: false, can_manage_users: false };
afterEach(cleanup);
const users: ManagedUser[] = [
  { id: "11111111-1111-4111-8111-111111111111", full_name: "Owner", email: "owner@example.com", role: "owner", status: "approved", permissions: flags },
  { id: "22222222-2222-4222-8222-222222222222", full_name: "Ana", email: "ana@example.com", role: "member", status: "pending", permissions: flags },
  { id: "33333333-3333-4333-8333-333333333333", full_name: "Bruno", email: "bruno@example.com", role: "member", status: "suspended", permissions: flags },
];
function mount() {
  const save = vi.fn(async () => ({ ok: false as const, code: "unavailable" as const, message: "Tente novamente." }));
  const remove = vi.fn(async (id: string) => ({ ok: true as const, id }));
  render(<UsersPanel initialUsers={users} currentUserId={users[0].id} onSave={save} onDelete={remove} onRefresh={async () => ({ ok: true, users })} />);
  return { save, remove };
}
describe("reference-style users panel", () => {
  it("navigates the custom status list with keys and restores focus on Escape", () => {
    mount();fireEvent.click(screen.getByRole("button",{name:"Editar Ana"}));
    const trigger=screen.getByRole("button",{name:"Status da conta: Pendente"});
    fireEvent.keyDown(trigger,{key:"ArrowDown"});
    const pending=screen.getByRole("option",{name:"Pendente"});
    expect(pending).toHaveFocus();
    fireEvent.keyDown(pending,{key:"ArrowDown"});
    expect(screen.getByRole("option",{name:"Aprovada"})).toHaveFocus();
    fireEvent.keyDown(document.activeElement!,{key:"Escape"});
    expect(trigger).toHaveFocus();expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("locks the editor while saving and leaves the row unchanged until confirmation", async () => {
    let finish!:(result:{ok:true;user:ManagedUser})=>void;
    const save=vi.fn(()=>new Promise<{ok:true;user:ManagedUser}>(resolve=>{finish=resolve;}));
    render(<UsersPanel initialUsers={users} currentUserId={users[0].id} onSave={save} onDelete={async id=>({ok:true,id})} onRefresh={async()=>({ok:true,users})}/>);
    fireEvent.click(screen.getByRole("button",{name:"Editar Ana"}));
    fireEvent.change(screen.getByLabelText("Nome completo"),{target:{value:"Ana Silva"}});
    fireEvent.click(screen.getByRole("button",{name:"Salvar alterações"}));
    expect(screen.getByLabelText("Nome completo")).toBeDisabled();
    expect(screen.getByRole("button",{name:"Fechar editor"})).toBeDisabled();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    finish({ok:true,user:{...users[1],full_name:"Ana Silva"}});
    await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
  });
  it("separates pending requests with counted chips and searchable compact rows", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Pendentes 1" }));
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.queryByText("Bruno")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Todos 3" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "bruno@" } });
    expect(screen.getByText("Bruno").closest(".user-row")).not.toBeNull();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  });
  it("uses custom status/permission controls and retains a failed draft", async () => {
    const { save } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Editar Ana" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("users-modal-card");
    expect(dialog.querySelector("select")).toBeNull();
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(6);
    expect(dialog.querySelectorAll(".permission-option")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Status da conta: Pendente" }));
    fireEvent.click(screen.getByRole("option", { name: "Aprovada" }));
    fireEvent.click(screen.getByLabelText(/Visualizar todos/));
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana Silva" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(users[1].id, expect.objectContaining({ full_name: "Ana Silva", status: "approved", permissions: expect.objectContaining({ can_view_all: true }) })));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tente novamente");
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Ana Silva");
  });
  it("protects owner controls and explains the invariant", () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Editar Owner" }));
    expect(screen.getByText(/Contas owner são protegidas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Excluir usuário" })).toBeDisabled();
  });
  it("requires explicit deletion confirmation and updates only after success", async () => {
    const { remove } = mount(); fireEvent.click(screen.getByRole("button", { name: "Editar Ana" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir usuário" }));
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/ocorrências.*preservadas/);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(screen.queryByText("Ana")).not.toBeInTheDocument());
  });
});
