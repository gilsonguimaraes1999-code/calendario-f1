import { deleteUser, updateUserAccess } from "@/features/users/actions";
import { rejectUnsafeOrigin, userResponse } from "@/features/users/http";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  const rejected = rejectUnsafeOrigin(request); if (rejected) return rejected;
  let input: unknown;
  try { input = await request.json(); } catch { return userResponse({ ok: false, code: "validation", message: "Dados inválidos. Confira o formulário." }); }
  const { id } = await context.params;
  return userResponse(await updateUserAccess(id,input));
}
export async function DELETE(request: Request, context: Context) {
  const rejected = rejectUnsafeOrigin(request); if (rejected) return rejected;
  const { id } = await context.params;
  return userResponse(await deleteUser(id));
}
