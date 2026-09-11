import { z } from "zod";
import { getAppOrigin } from "@/lib/env";
import { calendarTools } from "@/features/webmcp/tools";
import { executeCalendarTool } from "@/features/webmcp/service";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control":"no-store" };
export async function GET() {
  // App-specific HTTP companion; browser registration uses document.modelContext.
  return Response.json({ name:"Calendário F1", version:1, transport:"same-origin-json", endpoint:"/.well-known/webmcp", authentication:"session-cookie", tools:calendarTools },{headers});
}
export async function POST(request: Request) {
  if(request.headers.get("origin")!==(getAppOrigin()??new URL(request.url).origin)) return Response.json({ok:false,code:"forbidden",message:"Origem inválida. Reabra o calendário."},{status:403,headers});
  let body:unknown;
  try {body=await request.json();}catch{return Response.json({ok:false,code:"validation",message:"JSON inválido."},{status:400,headers});}
  const parsed=z.object({tool:z.string(),input:z.unknown()}).strict().safeParse(body);
  if(!parsed.success)return Response.json({ok:false,code:"validation",message:"Informe ferramenta e parâmetros."},{status:400,headers});
  const result=await executeCalendarTool(parsed.data.tool,parsed.data.input);
  const status=result.ok?200:({unauthenticated:401,forbidden:403,validation:400,conflict:409,not_found:404,unavailable:503} as const)[result.code];
  return Response.json(result,{status,headers});
}
