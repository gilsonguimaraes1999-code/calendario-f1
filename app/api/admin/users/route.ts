import { listUsers } from "@/features/users/actions";
import { userResponse } from "@/features/users/http";
export const dynamic = "force-dynamic";
export async function GET() { return userResponse(await listUsers()); }
