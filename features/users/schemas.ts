import { z } from "zod";
export const accountStatusSchema = z.enum(["pending", "approved", "rejected", "suspended"]);
export const userPermissionsSchema = z.object({ can_view: z.boolean(), can_view_all: z.boolean(), can_create: z.boolean(), can_edit: z.boolean(), can_delete: z.boolean(), can_manage_users: z.boolean() }).strict();
export const userChangesSchema = z.object({ full_name: z.string().trim().min(1).max(200).optional(), status: accountStatusSchema.optional(), permissions: userPermissionsSchema.optional() }).strict().refine(value => Object.values(value).some(field => field !== undefined));
export const managedUserSchema = z.object({ id: z.string().uuid(), full_name: z.string(), email: z.string(), role: z.enum(["owner", "member"]), status: accountStatusSchema, permissions: userPermissionsSchema });
export type ManagedUser = z.infer<typeof managedUserSchema>;
export type UserChanges = z.infer<typeof userChangesSchema>;
export type UserError = { ok: false; code: "validation" | "unauthenticated" | "forbidden" | "protected" | "not_found" | "unavailable"; message: string };
export type UserResult<T> = ({ ok: true } & T) | UserError;
