import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { PasswordForm } from "@/components/auth/password-form";

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => null }));
afterEach(cleanup);
describe("auth forms", () => {
  it("reveals and conceals the password without submitting", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Senha", { exact: true })).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(screen.getByLabelText("Senha", { exact: true })).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(screen.getByLabelText("Senha", { exact: true })).toHaveAttribute("type", "password");
  });
  it("submits the real action and offers retry when unconfigured", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "person@example.test" } });
    fireEvent.change(screen.getByLabelText("Senha", { exact: true }), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("form", { name: "Entrar no Calendário F1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/configurado/i);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });
  it("shows inline confirmation errors from the real registration action", async () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Test Person" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "person@example.test" } });
    fireEvent.change(screen.getByLabelText("Senha", { exact: true }), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "different123" } });
    fireEvent.submit(screen.getByRole("form", { name: "Solicitar acesso" }));
    expect(await screen.findByText("As senhas precisam ser iguais.")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar senha")).toHaveAttribute("aria-invalid", "true");
  });
  it("offers a fresh link when resetting a password", () => {
    render(<PasswordForm mode="update" />);
    expect(screen.getByRole("link", { name: "Solicitar novo link" })).toHaveAttribute("href", "/forgot-password");
  });
});
