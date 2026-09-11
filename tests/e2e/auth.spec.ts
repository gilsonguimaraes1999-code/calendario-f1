import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";

test.use({ channel: "msedge" });
const origin = process.env.AUTH_TEST_ORIGIN || "http://localhost:3000";

test("public access request and recovery remain usable without backend configuration",async({page})=>{
  await page.goto(`${origin}/register`);
  await page.getByLabel("Nome completo").fill("Local Test");await page.getByLabel("E-mail").fill("local@example.test");await page.getByLabel("Senha",{exact:true}).fill("test-password-123");await page.getByLabel("Confirmar senha").fill("test-password-123");await page.getByRole("button",{name:"Solicitar acesso",exact:true}).click();
  await expect(page.getByRole("form",{name:"Solicitar acesso"}).getByRole("alert")).toContainText("configurado");
  await page.goto(`${origin}/forgot-password`);await page.getByLabel("E-mail").fill("local@example.test");await page.getByRole("button",{name:"Enviar link de recuperação"}).click();await expect(page.getByRole("form",{name:"Recuperar senha"}).getByRole("alert")).toContainText("configurado");
});
test("keyboard focus and reduced-motion login stay usable at 200 percent text",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});await page.setViewportSize({width:390,height:844});await page.goto(`${origin}/login`);
  await page.addStyleTag({content:"html{font-size:32px}"});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const email=page.getByLabel("E-mail");await email.focus();await page.keyboard.press("Tab");await expect(page.getByLabel("Senha",{exact:true})).toBeFocused();
  await page.keyboard.press("Tab");await expect(page.getByRole("button",{name:"Mostrar senha"})).toBeFocused();
  expect(await page.getByRole("button",{name:"Entrar",exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThan(0.001);
});
test("WebMCP companion rejects anonymous execution without exposing month data",async({request})=>{
  const manifest=await request.get(`${origin}/.well-known/webmcp`);expect(manifest.ok()).toBe(true);expect((await manifest.json()).tools).toHaveLength(2);
  const result=await request.post(`${origin}/.well-known/webmcp`,{headers:{Origin:origin},data:{tool:"consult_calendar_month",input:{year:2026,month:9}}});expect(result.status()).toBe(401);
  expect(await result.json()).not.toHaveProperty("incidents");
});

test("user administration page and API require a verified session", async ({ page }) => {
  await page.goto(`${origin}/admin/users`);
  await expect(page).toHaveURL(`${origin}/login`);
  const response=await page.request.get(`${origin}/api/admin/users`);
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toMatchObject({ok:false,code:"unauthenticated"});
});

test("site icon serves the exact attached SantaGroup A PNG", async ({ page }) => {
  await page.goto(`${origin}/login`);
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute("href", "/santagroup-a.png?v=aebbb105");
  await expect(icon).toHaveAttribute("type", "image/png");
  await expect(page.locator('link[rel="shortcut icon"]')).toHaveAttribute("href", "/santagroup-a.png?v=aebbb105");
  const response = await page.request.get(new URL((await icon.getAttribute("href"))!, origin).href);
  expect(response.ok()).toBe(true);
  expect(createHash("sha256").update(await response.body()).digest("hex")).toBe("aebbb1053028368f7add1ca8c8ca410f6e0c5f63e188eeb722426d8fdab922cc");
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`login preserves the compact reference composition at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/login`);
    const form = page.getByRole("form", { name: "Entrar no Calendário F1" });
    await expect(form).toBeVisible();
    const formBox = (await form.boundingBox())!;
    expect(formBox.width).toBeLessThanOrEqual(392);
    expect(Math.abs(formBox.x + formBox.width / 2 - viewport.width / 2)).toBeLessThan(2);
    await expect(page.locator("header")).toHaveCount(0);
    const logo = page.getByRole("img", { name: "Calendário F1" });
    const logoBox = (await logo.boundingBox())!;
    expect(logoBox.width).toBeGreaterThanOrEqual(176);
    expect(logoBox.y + logoBox.height).toBeLessThan(formBox.y);
    expect(await form.evaluate((element) => {
      let node: Element | null = element;
      while (node && node.tagName !== "MAIN") {
        const style = getComputedStyle(node);
        if (style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.boxShadow !== "none") return false;
        node = node.parentElement;
      }
      return true;
    })).toBe(true);
    const email = page.getByLabel("E-mail");
    await expect(email).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(email).toHaveCSS("height", "36px");
    const submit = page.getByRole("button", { name: "Entrar", exact: true });
    await expect(submit).toHaveCSS("background-color", "rgb(212, 175, 55)");
    const recoveryBox = (await page.getByRole("link", { name: "Esqueci minha senha" }).boundingBox())!;
    const submitBox = (await submit.boundingBox())!;
    const accessBox = (await page.getByRole("link", { name: "Solicitar novo acesso" }).boundingBox())!;
    expect(recoveryBox.y).toBeGreaterThan(submitBox.y + submitBox.height);
    expect(accessBox.y).toBeGreaterThan(recoveryBox.y);
    expect(Math.abs(recoveryBox.x + recoveryBox.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await expect(page.locator(".app-background--stars canvas")).toBeVisible();
    await page.screenshot({ path: `test-results/login-${viewport.width}.png`, fullPage: true });
  });
}

test("unconfigured calendar is protected and login submission is recoverable", async ({ page }) => {
  await page.goto(`${origin}/calendar`);
  await expect(page).toHaveURL(`${origin}/login`);
  await page.getByLabel("E-mail").fill("person@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("form", { name: "Entrar no Calendário F1" }).getByRole("alert")).toContainText("configurado");
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
});
