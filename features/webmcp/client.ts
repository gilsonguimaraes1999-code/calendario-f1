import { calendarTools, type CalendarToolName } from "./tools";
export type ModelContext = { registerTool: (tool: { name: string; description: string; inputSchema: object; execute: (input: unknown) => Promise<unknown> }, options?: { signal?: AbortSignal }) => void | Promise<void> };
export function registerCalendarTools(context: ModelContext | undefined, execute: (tool: CalendarToolName, input: unknown) => Promise<unknown>) {
  const lifecycle = new AbortController();
  if (context?.registerTool) for (const tool of calendarTools) {
    try { void Promise.resolve(context.registerTool({ ...tool, execute: input => execute(tool.name,input) },{ signal:lifecycle.signal })).catch(()=>lifecycle.abort()); }
    catch { lifecycle.abort(); break; }
  }
  return () => lifecycle.abort();
}
