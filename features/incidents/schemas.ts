import { z } from "zod";
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido");
const common = { date: z.string().date("Data inválida"), note: z.string().trim().min(1, "Anotação obrigatória") };
export const incidentInputSchema = z.discriminatedUnion("kind", [
  z.object({ ...common, kind: z.literal("partial"), startTime: time, endTime: time }).refine(({ startTime, endTime }) => startTime < endTime, { message: "O horário final deve ser posterior ao inicial", path: ["endTime"] }),
  z.object({ ...common, kind: z.literal("full_day"), startTime: z.null(), endTime: z.null() }),
]);
export const incidentSchema = z.intersection(z.object({ id: z.string().min(1), authorId: z.string().min(1).nullable() }), incidentInputSchema);
export const monthSchema = z.object({ year: z.number().int().min(1900).max(9999), month: z.number().int().min(1).max(12) });
