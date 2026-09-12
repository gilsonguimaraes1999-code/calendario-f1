import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import type { ManagedUser } from "../../features/users/schemas";
test.use({ channel:"msedge" });
const user:ManagedUser={id:"22222222-2222-4222-8222-222222222222",full_name:"Ana Silva",email:"ana.silva@example.test",role:"member",status:"pending",permissions:{can_view:true,can_view_all:false,can_create:true,can_edit:false,can_delete:false,can_manage_users:false}};
const save=async()=>({ok:true as const,user}), remove=async()=>({ok:true as const,id:user.id});
const css=readFileSync(resolve("app/globals.css"),"utf8").replace(/^@import[^\r\n]+/m,"");
let vite: Awaited<ReturnType<typeof import("vitest/node")["createViteServer"]>>;
let UsersPanel: typeof import("../../components/users/users-panel")["UsersPanel"];
let UserEditor: typeof import("../../components/users/user-editor")["UserEditor"];
test.beforeAll(async()=>{
  const {createViteServer}=await import("vitest/node");
  vite=await createViteServer({configFile:false,server:{middlewareMode:true},esbuild:{jsx:"automatic"},resolve:{alias:{"@":resolve(".")}}});
  UsersPanel=(await vite.ssrLoadModule("/components/users/users-panel.tsx")).UsersPanel;
  UserEditor=(await vite.ssrLoadModule("/components/users/user-editor.tsx")).UserEditor;
});
test.afterAll(async()=>{await vite?.close();});
test("users layout supports 200 percent text without horizontal overflow",async({page})=>{
  await page.setViewportSize({width:1024,height:1000});
  const html=renderToStaticMarkup(React.createElement(UsersPanel,{initialUsers:[user],currentUserId:"owner",onSave:save,onDelete:remove,onRefresh:async()=>({ok:true as const,users:[user]})}));
  await page.setContent(`<style>${css} html{font-size:32px}</style>${html}`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
  const row=page.locator("article.user-row");
  expect(await row.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
// Render actual production presentation components with local fixture props only.
// No test route, auth bypass, account mutation, or Supabase request is introduced.
for(const width of [1440,390]) {
 test(`users reference composition at ${width}px`,async({page},testInfo)=>{
   await page.setViewportSize({width,height:1000});
   const html=renderToStaticMarkup(React.createElement(UsersPanel,{initialUsers:[user],currentUserId:"owner",onSave:save,onDelete:remove,onRefresh:async()=>({ok:true as const,users:[user]})}));
   await page.setContent(`<style>${css}</style>${html}`);
   const row=page.locator("article.user-row");
   await expect(row).toHaveCSS("display","grid");
   await expect(page.locator(".filter-chip.active")).toHaveCSS("border-radius","999px");
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   const columns=await row.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").length);
   expect(columns).toBe(width<1024?2:5);
   await page.screenshot({path:testInfo.outputPath(`users-${width}.png`),fullPage:true});
   const editor=renderToStaticMarkup(React.createElement(UserEditor,{user,currentUserId:"owner",onSave:save,onDelete:remove,onClose:()=>{}}));
   await page.setContent(`<style>${css}</style>${html}${editor}`);
   const dialog=page.getByRole("dialog");
   await expect(dialog).toHaveCSS("background-color","rgb(12, 12, 12)");
   expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(Math.min(width-32,720));
   await expect(dialog.locator("select")).toHaveCount(0);
   await expect(dialog.locator(".permission-option")).toHaveCount(6);
   await expect(dialog.locator(".users-check").first()).toHaveCSS("width","16px");
   await expect(dialog.locator('.users-check[data-checked="true"]').first()).toHaveCSS("background-color","rgb(212, 175, 55)");
   expect(await dialog.locator(".button-gold").evaluate(el=>getComputedStyle(el).backgroundImage)).toContain("linear-gradient");
   await expect(dialog.locator(".button-gold")).toHaveCSS("color","rgb(8, 8, 8)");
   await page.screenshot({path:testInfo.outputPath(`user-editor-${width}.png`),fullPage:true});
 });
}
