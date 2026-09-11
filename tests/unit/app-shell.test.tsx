// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RootLayout, { metadata } from "../../app/layout";
import { AppHeader } from "../../components/layout/app-header";
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => null }));

describe("RootLayout", () => {
  it("prioritizes the exact attached PNG with a fresh cache key", () => {
    expect(metadata.icons).toMatchObject({icon:[{url:"/santagroup-a.png?v=aebbb105",type:"image/png"}],shortcut:"/santagroup-a.png?v=aebbb105"});
  });
  it("shows users navigation only when authorized", () => {
    expect(renderToStaticMarkup(<AppHeader />)).not.toContain('href="/admin/users"');
    expect(renderToStaticMarkup(<AppHeader canManageUsers />)).toContain('href="/admin/users"');
  });
  it("keeps the brand as the only calendar navigation link in the header", () => {
    const markup = renderToStaticMarkup(<AppHeader />);
    expect(markup.match(/href="\/calendar"/g)).toHaveLength(1);
    expect(markup).toContain('aria-label="Calendário F1"');
    expect(markup).toContain('class="app-header__brand"');
  });

  it("server-renders children in a Portuguese document shell", () => {
    const markup = renderToStaticMarkup(<RootLayout><main>Calendário F1</main></RootLayout>);

    expect(markup).toContain("<main>Calendário F1</main>");
    expect(markup).toContain('<html lang="pt-BR">');
    expect(markup).toContain('class="app-shell"');
    expect(markup).not.toContain("<header");
  });
});
