// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("allows both exact local Auth destinations without broadening the allowlist", () => {
  const config = readFileSync(resolve("supabase/config.toml"), "utf8");
  const list = config.match(/^additional_redirect_urls\s*=\s*(\[[^\]]*\])/m)?.[1];
  expect(list).toBeDefined();
  expect(JSON.parse(list!)).toEqual([
    "http://localhost:3000/auth/callback",
    "http://localhost:3000/auth/callback?next=reset-password",
  ]);
  expect(config).toContain('site_url = "http://localhost:3000"');
});

it("documents the authorized repository without claiming deployment", () => {
  const readme = readFileSync(resolve("README.md"), "utf8");
  expect(readme).toContain("https://github.com/gilsonguimaraes1999-code/calendario-f1");
  expect(readme).toContain("publicação do código no GitHub foi autorizada");
  expect(readme).not.toContain("próxima etapa, ainda não autorizada/executada");
});
