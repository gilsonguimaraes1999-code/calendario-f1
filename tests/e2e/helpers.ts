import type { Page } from "@playwright/test";
export function localOrigin(value:string) {
  const url=new URL(value);
  if(!["http:","https:"].includes(url.protocol)||!["localhost","127.0.0.1","[::1]"].includes(url.hostname)||url.username||url.password)throw new Error("E2E permits loopback origins only.");
  return url.origin;
}
export function liveTestConfig(env:Record<string,string|undefined>) {
  if(env.E2E_LOCAL_SUPABASE!=="1"||env.E2E_ALLOW_MUTATIONS!=="I_UNDERSTAND_LOCAL_TEST_DATA")return null;
  const keys=["E2E_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_URL","E2E_OWNER_EMAIL","E2E_OWNER_PASSWORD","E2E_MEMBER_EMAIL","E2E_MEMBER_PASSWORD","E2E_TEST_MONTH"];
  if(keys.some(key=>!env[key]))return null;
  try { if(localOrigin(env.E2E_SUPABASE_URL!)!==localOrigin(env.NEXT_PUBLIC_SUPABASE_URL!))return null; } catch{return null;}
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(env.E2E_TEST_MONTH!))return null;
  if(env.E2E_MEMBER_EMAIL===env.E2E_OWNER_EMAIL)return null;
  return {ownerEmail:env.E2E_OWNER_EMAIL!,ownerPassword:env.E2E_OWNER_PASSWORD!,memberEmail:env.E2E_MEMBER_EMAIL!,memberPassword:env.E2E_MEMBER_PASSWORD!,month:env.E2E_TEST_MONTH!};
}
export async function login(page:Page,email:string,password:string) {
  await page.goto("/login");await page.getByLabel("E-mail").fill(email);await page.getByLabel("Senha",{exact:true}).fill(password);await page.getByRole("button",{name:"Entrar",exact:true}).click();
}
export function dayLabel(date:string) {return new Intl.DateTimeFormat("pt-BR",{day:"numeric",month:"long",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`));}
export async function openDay(page:Page,date:string) {await page.getByRole("button",{name:new RegExp(`^${dayLabel(date)},`)}).click();}
export async function createPartialIncident(page:Page,date:string,start:string,end:string,note:string) {
  await openDay(page,date);await page.getByRole("button",{name:"Adicionar ocorrência"}).click();await page.getByLabel("Início").fill(start);await page.getByLabel("Fim").fill(end);await page.getByLabel("Anotação").fill(note);await page.getByRole("button",{name:"Salvar ocorrência"}).click();
  await page.getByText(note,{exact:true}).waitFor();await page.getByRole("button",{name:"Fechar painel do dia"}).click();
}
