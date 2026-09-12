"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/features/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageUsers } from "./access";
import { managedUserSchema, userChangesSchema, type ManagedUser, type UserError, type UserResult } from "./schemas";
const messages = {
  validation: "Confira os dados e as permissões informados.",
  unauthenticated: "Sua sessão expirou ou o serviço não está configurado. Entre novamente quando estiver disponível.",
  forbidden: "Você não tem permissão para administrar usuários. Atualize a página e verifique seu acesso.",
  protected: "Contas owner e a própria conta são protegidas contra alterações e exclusão neste painel.",
  not_found: "O usuário não está mais disponível. Atualize a lista.",
  unavailable: "Não foi possível concluir agora. Tente novamente em instantes.",
};
function failure(code: UserError["code"]): UserError { return { ok: false, code, message: messages[code] }; }
function safeError(cause: unknown): UserError {
  const code = typeof cause === "object" && cause && "code" in cause ? String(cause.code) : "";
  return failure(code === "42501" ? "forbidden" : code === "P0001" ? "protected" : code === "P0002" ? "not_found" : "unavailable");
}
async function access(targetId?: string) {
  const context = await getAccessContext();
  if (!context) return { error: failure("unauthenticated") };
  if (!canManageUsers(context)) return { error: failure("forbidden") };
  if (targetId === context.user.id) return { error: failure("protected") };
  const client = await createServerSupabaseClient();
  return client ? { client } : { error: failure("unavailable") };
}
export async function listUsers(): Promise<UserResult<{ users: ManagedUser[] }>> {
  try {
    const authorized = await access(); if (authorized.error) return authorized.error;
    const users: ManagedUser[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await authorized.client!.rpc("list_access_users", { page_offset: offset, page_size: 500 });
      if (result.error) throw result.error;
      const page = z.array(managedUserSchema).parse(result.data);
      users.push(...page);
      if (page.length < 500) break;
    }
    return { ok: true, users };
  } catch (cause) { return safeError(cause); }
}
export async function updateUserAccess(id: string, input: unknown): Promise<UserResult<{ user: ManagedUser }>> {
  const parsed = userChangesSchema.safeParse(input);
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return failure("validation");
  try {
    const authorized = await access(id); if (authorized.error) return authorized.error;
    const result = await authorized.client!.rpc("update_access_user", { target_id: id, changes: parsed.data });
    if (result.error) throw result.error;
    const user = managedUserSchema.parse(result.data);
    revalidatePath("/admin/users"); revalidatePath("/calendar");
    return { ok: true, user };
  } catch (cause) { return safeError(cause); }
}
export async function updateUserStatus(id: string, status: unknown) { return updateUserAccess(id, { status }); }
export async function updateUserPermissions(id: string, permissions: unknown) { return updateUserAccess(id, { permissions }); }
export async function deleteUser(id: string): Promise<UserResult<{ id: string }>> {
  if (!z.string().uuid().safeParse(id).success) return failure("validation");
  try {
    const authorized = await access(id); if (authorized.error) return authorized.error;
    const result = await authorized.client!.rpc("delete_access_user", { target_id: id });
    if (result.error) throw result.error;
    if (result.data !== id) return failure("unavailable");
    revalidatePath("/admin/users"); revalidatePath("/calendar");
    return { ok: true, id };
  } catch (cause) { return safeError(cause); }
}
