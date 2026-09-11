import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254);
const password = z.string().min(8, "Use pelo menos 8 caracteres.").max(128, "Use até 128 caracteres.");
export const loginSchema = z.object({ email, password: z.string().min(1, "Informe sua senha.").max(128) });
export const resetRequestSchema = z.object({ email });
export const updatePasswordSchema = z.object({ password, confirm_password: z.string() }).refine((value) => value.password === value.confirm_password, { message: "As senhas precisam ser iguais.", path: ["confirm_password"] });
export const registerSchema = z.object({ full_name: z.string().trim().min(2, "Informe seu nome completo.").max(200), email, password, confirm_password: z.string() }).refine((value) => value.password === value.confirm_password, { message: "As senhas precisam ser iguais.", path: ["confirm_password"] });

export type AuthState = { ok: boolean; message: string; fieldErrors?: Record<string, string[] | undefined> };
