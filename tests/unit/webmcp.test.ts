// @vitest-environment node
import {beforeEach,expect,it,vi} from "vitest";
import {incidentBackend} from "../support/incident-backend";
const boundary=vi.hoisted(()=>({client:null as unknown}));
vi.mock("@/lib/supabase/server",()=>({createServerSupabaseClient:async()=>boundary.client}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {GET,POST} from "@/app/.well-known/webmcp/route";
import {registerCalendarTools} from "@/features/webmcp/client";
let backend:ReturnType<typeof incidentBackend>;
const partial={date:"2026-09-02",kind:"partial",startTime:"10:00",endTime:"10:20",note:"Parada"};
const request=(tool:string,input:unknown,origin="http://localhost:3000")=>new Request("http://localhost:3000/.well-known/webmcp",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify({tool,input})});
beforeEach(()=>{backend=incidentBackend();boundary.client=backend.client;vi.stubEnv("APP_URL","http://localhost:3000");});
it("describes exactly two tools without private data",async()=>{
  const response=await GET();const manifest=await response.json();
  expect(manifest.tools.map((t:{name:string})=>t.name)).toEqual(["consult_calendar_month","register_incident"]);
  expect(JSON.stringify(manifest)).not.toContain(backend.state.user!.id);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("denies anonymous tool calls and unsafe origins",async()=>{
  boundary.client=null;
  expect((await POST(request("consult_calendar_month",{year:2026,month:9}))).status).toBe(401);
  expect((await POST(request("register_incident",partial,"https://evil.test"))).status).toBe(403);
  expect(backend.state.writes).toHaveLength(0);
});
it.each(["pending","rejected","suspended"])("denies %s identity",async status=>{
  backend.state.status=status;
  expect((await POST(request("register_incident",partial))).status).toBe(403);
  expect(backend.state.writes).toHaveLength(0);
});
it("uses real permission and incident validation boundaries",async()=>{
  backend.state.flags.can_create=false;
  expect((await POST(request("register_incident",partial))).status).toBe(403);
  backend.state.flags.can_create=true;
  expect((await POST(request("register_incident",{...partial,endTime:"09:59"}))).status).toBe(400);
  expect((await POST(request("unknown",{}))).status).toBe(400);
  expect(backend.state.writes).toHaveLength(0);
});
it("persists before confirming and derives metrics from the personal scope",async()=>{
  const response=await POST(request("register_incident",partial));
  expect(response.status).toBe(200);expect(backend.state.rows).toHaveLength(1);
  backend.state.rows.push({...backend.state.rows[0],id:"other",author_id:"other",note:"Hidden",start_time:"12:00",end_time:"13:00"});
  const month=await (await POST(request("consult_calendar_month",{year:2026,month:9}))).json();
  expect(month.incidents).toHaveLength(1);expect(month.metrics.unavailableMinutes).toBe(20);
  expect(month.summary).toContain("20 min");
  backend.state.flags.can_view_all=true;
  const all=await (await POST(request("consult_calendar_month",{year:2026,month:9}))).json();
  expect(all.incidents).toHaveLength(2);expect(all.metrics.unavailableMinutes).toBe(80);
});
it("registers and cleans up browser tools, returning transport results",async()=>{
  const registrations: {tool:{name:string;execute:(input:unknown)=>Promise<unknown>};signal:AbortSignal}[]=[];
  const execute=vi.fn(async()=>({ok:true}));
  const cleanup=registerCalendarTools({registerTool:(tool,options)=>{registrations.push({tool,signal:options!.signal!});}},execute);
  expect(registrations.map(item=>item.tool.name)).toEqual(["consult_calendar_month","register_incident"]);
  expect(await registrations[1].tool.execute(partial)).toEqual({ok:true});
  expect(execute).toHaveBeenCalledWith("register_incident",partial);
  cleanup();expect(registrations.every(item=>item.signal.aborted)).toBe(true);
});
it("handles unsupported contexts and rejected registration without throwing",async()=>{
  expect(()=>registerCalendarTools(undefined,async()=>null)()).not.toThrow();
  expect(()=>registerCalendarTools({registerTool:()=>Promise.reject(new Error("unsupported"))},async()=>null)()).not.toThrow();
  await Promise.resolve();
});
