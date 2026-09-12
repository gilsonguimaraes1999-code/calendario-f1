"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext, type Permissions } from "@/features/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { incidentInputSchema, monthSchema } from "./schemas";
import { incidentRepository } from "./repository";
import type { Incident, IncidentError, IncidentResult } from "./types";

const unavailable: IncidentError = { ok: false, code: "unavailable", message: "Não foi possível concluir agora. Tente novamente em instantes." };
const forbidden: IncidentError = { ok: false, code: "forbidden", message: "Você não tem permissão para esta ação. Verifique seu acesso com o administrador." };
const notFound: IncidentError = { ok: false, code: "not_found", message: "A ocorrência não está disponível ou seu acesso mudou. Atualize o mês e tente novamente." };
const invalid: IncidentError = { ok: false, code: "validation", message: "Confira a data e os horários informados." };
function safeError(cause: unknown): IncidentError {
  const code = typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "";
  if (code === "23P01" || code === "23505") return { ok: false, code: "conflict", message: "Este dia já tem um registro incompatível. Atualize o mês e revise as ocorrências antes de tentar novamente." };
  if (code === "42501") return forbidden;
  return unavailable;
}
async function access(permission: keyof Permissions) {
  const context = await getAccessContext();
  if (!context) return { error: { ok: false, code: "unauthenticated", message: "Sua sessão expirou. Entre novamente para continuar." } as IncidentError };
  if (context.access !== "allow" || !context.permissions[permission]) return { error: forbidden };
  const client = await createServerSupabaseClient();
  if (!client) return { error: unavailable };
  return { repository: incidentRepository(client, { userId: context.user.id, viewAll: context.permissions.can_view_all }), permissions: context.permissions };
}

export async function listIncidentsForMonth(year: number, month: number): Promise<IncidentResult<{ incidents: Incident[]; permissions: Permissions }>> {
  if (!monthSchema.safeParse({ year, month }).success) return { ...invalid, message: "Mês inválido. Escolha um mês entre 1900 e 9999." };
  try {
    const authorized = await access("can_view");
    if (authorized.error) return authorized.error;
    return { ok: true, incidents: await authorized.repository.list(year, month), permissions: authorized.permissions };
  } catch (cause) { return safeError(cause); }
}

export async function createIncident(input: unknown): Promise<IncidentResult<{ incident: Incident }>> {
  const parsed = incidentInputSchema.safeParse(input);
  if (!parsed.success) return invalid;
  try {
    const authorized = await access("can_create");
    if (authorized.error) return authorized.error;
    const incident = await authorized.repository.create(parsed.data);
    if (!incident) return unavailable;
    revalidatePath("/calendar");
    return { ok: true, incident };
  } catch (cause) { return safeError(cause); }
}

export async function updateIncident(id: string, input: unknown): Promise<IncidentResult<{ incident: Incident }>> {
  const parsed = incidentInputSchema.safeParse(input);
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return invalid;
  try {
    const authorized = await access("can_edit");
    if (authorized.error) return authorized.error;
    const incident = await authorized.repository.update(id, parsed.data);
    if (!incident) return notFound;
    revalidatePath("/calendar");
    return { ok: true, incident };
  } catch (cause) { return safeError(cause); }
}

export async function deleteIncident(id: string): Promise<IncidentResult<{ id: string }>> {
  if (!z.string().uuid().safeParse(id).success) return invalid;
  try {
    const authorized = await access("can_delete");
    if (authorized.error) return authorized.error;
    if (!await authorized.repository.remove(id)) return notFound;
    revalidatePath("/calendar");
    return { ok: true, id };
  } catch (cause) { return safeError(cause); }
}

