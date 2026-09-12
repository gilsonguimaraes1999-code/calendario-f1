import {test,expect} from "@playwright/test";
import {liveTestConfig,login,openDay,createPartialIncident,dayLabel} from "./helpers";
const live=liveTestConfig(process.env);
test.describe("local Supabase seeded flow (explicit opt-in)",()=>{
  test.skip(!live,"Requires explicit local-only mutation consent, matching loopback Supabase and dedicated seeded accounts. Never executed by default.");
  test("pending approval, scoped visibility, partial/full-day CRUD and deterministic metrics",async({page,browser,baseURL})=>{
    test.setTimeout(180000);
    const config=live!;
    const memberContext=await browser.newContext({baseURL});const member=await memberContext.newPage();
    await login(page,config.ownerEmail,config.ownerPassword);await expect(page).toHaveURL(/\/calendar/);
    const directory=await (await page.request.get("/api/admin/users")).json();
    const target=directory.users.find((user:{email:string})=>user.email===config.memberEmail);
    expect(target?.role).toBe("member");expect(target?.status).toBe("pending");
    const headers={Origin:baseURL!};
    const consult=async(p=page)=> (await p.request.post("/.well-known/webmcp",{headers,data:{tool:"consult_calendar_month",input:{year:Number(config.month.slice(0,4)),month:Number(config.month.slice(5))}}})).json();
    const initial=await consult();expect(initial.ok).toBe(true);expect(initial.incidents).toHaveLength(0);
    const tag=`E2E-${Date.now()}`,partialDate=`${config.month}-02`,fullDate=`${config.month}-03`;
    try {
      await login(member,config.memberEmail,config.memberPassword);await expect(member).toHaveURL(/\/pending/);
      await page.goto("/admin/users");await page.getByRole("searchbox").fill(config.memberEmail);await page.getByRole("button",{name:`Editar ${target.full_name}`}).click();
      await page.getByRole("button",{name:"Status da conta: Pendente"}).click();await page.getByRole("option",{name:"Aprovada"}).click();
      await page.getByLabel(/Visualizar calendário/).check();await page.getByLabel(/Criar ocorrências/).check();await page.getByLabel(/Editar ocorrências/).check();await page.getByLabel(/Excluir ocorrências/).check();
      await page.getByRole("button",{name:"Salvar alterações"}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
      await member.goto(`/calendar?month=${config.month}`);await expect(member.getByRole("link",{name:"Usuários",exact:true})).toHaveCount(0);
      await createPartialIncident(member,partialDate,"10:00","10:20",`${tag}-first`);
      await createPartialIncident(member,partialDate,"14:00","14:15",`${tag}-second`);
      await expect(member.getByRole("button",{name:`${dayLabel(partialDate)}, 2 interrupções, 35 minutos`})).toBeVisible();
      await page.goto(`/calendar?month=${config.month}`);await openDay(page,fullDate);await page.getByRole("button",{name:"Adicionar ocorrência"}).click();await page.getByLabel("Dia inteiro",{exact:true}).check();await page.getByLabel("Anotação").fill(`${tag}-full`);await page.getByRole("button",{name:"Salvar ocorrência"}).click();await expect(page.getByText(`${tag}-full`,{exact:true})).toBeVisible();await page.getByRole("button",{name:"Fechar painel do dia"}).click();
      expect((await consult(member)).incidents).toHaveLength(2);
      const all=await consult();expect(all.metrics).toMatchObject({fullDays:1,interruptions:2,unavailableMinutes:1475});expect(all.summary).toContain("35 min");
      const changed=await page.request.patch(`/api/admin/users/${target.id}`,{headers,data:{permissions:{...target.permissions,can_view:true,can_view_all:true,can_create:true,can_edit:true,can_delete:true}}});expect(changed.ok()).toBe(true);
      await member.reload();expect((await consult(member)).incidents).toHaveLength(3);
      await openDay(member,partialDate);await member.locator(".incident-card").filter({hasText:`${tag}-first`}).getByRole("button",{name:"Editar ocorrência"}).click();await member.getByLabel("Fim").fill("10:30");await member.getByRole("button",{name:"Salvar alterações"}).click();await expect(member.getByText(`${tag}-first`,{exact:true})).toBeVisible();await member.getByRole("button",{name:"Fechar painel do dia"}).click();
      expect((await consult()).metrics.unavailableMinutes).toBe(1485);
      await openDay(member,partialDate);const second=member.locator(".incident-card").filter({hasText:`${tag}-second`});await second.getByRole("button",{name:"Excluir ocorrência"}).click();await second.getByRole("button",{name:"Confirmar exclusão"}).click();await expect(member.getByText(`${tag}-second`,{exact:true})).toHaveCount(0);await member.getByRole("button",{name:"Fechar painel do dia"}).click();
      await member.reload();const final=await consult(member);expect(final.metrics).toMatchObject({fullDays:1,interruptions:1,unavailableMinutes:1470});expect(final.summary).toContain("30 min");
    } finally {
      // Remove only this run's tagged rows using the owner's normal UI actions.
      try {
        const result=await consult();
        if(result.ok) for(const incident of result.incidents.filter((item:{note:string})=>item.note.startsWith(tag))){await page.goto(`/calendar?month=${config.month}`);await openDay(page,incident.date);const card=page.locator(".incident-card").filter({hasText:incident.note});await card.getByRole("button",{name:"Excluir ocorrência"}).click();await card.getByRole("button",{name:"Confirmar exclusão"}).click();await expect(page.getByText(incident.note,{exact:true})).toHaveCount(0);}
      } finally {
        try { const restored=await page.request.patch(`/api/admin/users/${target.id}`,{headers,data:{full_name:target.full_name,status:target.status,permissions:target.permissions}});expect(restored.ok()).toBe(true); }
        finally { await memberContext.close(); }
      }
    }
  });
});
