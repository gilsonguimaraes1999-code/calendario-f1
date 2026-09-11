# Calendário F1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir uma aplicação independente para registrar indisponibilidades do F1, controlar acessos e calcular métricas e resumos mensais sem IA.

**Architecture:** Aplicação Next.js 16 com App Router, componentes React e Supabase Auth/PostgreSQL. Regras puras de domínio calculam duração, agregações e resumo; Server Actions e repositórios isolam persistência; Row Level Security aplica as permissões no banco.

**Tech Stack:** Next.js 16.3.3, React 19.2.0, TypeScript 5.9, Tailwind CSS 4, Supabase SSR/JS, Zod 4, Lucide React, Vitest, Testing Library e Playwright.

**Spec:** `docs/superpowers/specs/2026-09-11-calendario-f1-design.md`

## Global Constraints

- O produto acompanha somente o F1 nesta versão.
- O ZIP de referência é somente leitura; nenhum arquivo do projeto original será alterado.
- O produto deve funcionar primeiro no localhost e não será publicado antes da validação local.
- O resumo mensal é determinístico e não usa API de IA.
- A interface usa a identidade preta, dourada e espacial da referência sem controles nativos do Windows.
- Todas as mutações exigem validação no servidor e autorização por Row Level Security.
- Segredos ficam apenas em `.env.local`, que nunca entra no Git.

---

## File Map

- `app/(auth)/*`: login, cadastro, recuperação e redefinição de senha.
- `app/(private)/*`: calendário e administração protegidos.
- `components/calendar/*`: grade mensal, célula do dia e painel de ocorrências.
- `components/metrics/*`: cartões e resumo mensal.
- `components/auth/*` e `components/users/*`: formulários e administração.
- `features/incidents/*`: tipos, validação, cálculos, consultas e Server Actions.
- `features/auth/*` e `features/users/*`: autorização, sessão e gestão de usuários.
- `lib/supabase/*`: clientes browser, server e admin.
- `supabase/migrations/*`: schema, constraints, funções e políticas RLS.
- `tests/unit/*` e `tests/e2e/*`: domínio, componentes, autorização e fluxos.

---

### Task 1: Base independente e identidade visual

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`
- Create: `vitest.config.ts`, `tests/setup.ts`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Create: `components/layout/app-background.tsx`, `components/layout/app-header.tsx`, `components/brand/starfield-background.tsx`
- Create: `public/angel-a.png`, `public/fundo-site-vetorial.svg`, `public/favicon.svg`
- Create: `.gitignore`, `.env.example`
- Test: `tests/unit/app-shell.test.tsx`

**Interfaces:**
- Consumes: os tokens e ativos visuais do ZIP de referência, copiados para o projeto novo.
- Produces: `AppBackground({ variant }: { variant: "stars" | "vector" })` e o shell global.

- [ ] **Step 1: Configurar o perfil de execução**

Run: `node C:\Users\gilso\.codex\plugins\cache\openai-curated-remote\sites\0.1.59\scripts\configure-execution-profile.mjs`
Expected: perfil `portable` salvo sem modificar o projeto de referência.

- [ ] **Step 2: Escrever o teste do shell**

~~~tsx
render(<RootLayout><main>Calendário F1</main></RootLayout>);
expect(screen.getByText("Calendário F1")).toBeInTheDocument();
expect(document.documentElement.lang).toBe("pt-BR");
~~~

- [ ] **Step 3: Rodar o teste e confirmar a falha**

Run: `pnpm vitest run tests/unit/app-shell.test.tsx`
Expected: FAIL porque o shell ainda não existe.

- [ ] **Step 4: Criar o projeto e o tema**

Use as versões do cabeçalho deste plano. Defina `--background: #050505`, `--gold: #d4af37`, `--gold-bright: #f0d77c`, `--danger: #dc5260`, fontes Inter/Outfit, foco visível, painéis translúcidos e redução de movimento. `app/page.tsx` redireciona para `/calendar`.

~~~json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --configLoader runner",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@supabase/ssr": "0.12.5",
    "@supabase/supabase-js": "2.57.4",
    "lucide-react": "0.544.0",
    "next": "16.3.3",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "zod": "4.1.11"
  }
}
~~~

- [ ] **Step 5: Validar e registrar**

Run: `pnpm vitest run tests/unit/app-shell.test.tsx`
Expected: PASS.

Run: `git add . && git commit -m "feat: scaffold F1 calendar visual shell"`

---

### Task 2: Domínio de ocorrências e métricas

**Files:**
- Create: `features/incidents/types.ts`
- Create: `features/incidents/schemas.ts`
- Create: `features/incidents/metrics.ts`
- Create: `features/incidents/summary.ts`
- Test: `tests/unit/incidents-domain.test.ts`

**Interfaces:**
- Produces: `Incident`, `MonthlyMetrics`, `calculateDurationMinutes(start, end)`, `aggregateMonth(incidents, year, month)` e `buildMonthlySummary(metrics, locale)`.

- [ ] **Step 1: Escrever testes das regras**

~~~ts
expect(calculateDurationMinutes("10:00", "10:20")).toBe(20);
expect(() => calculateDurationMinutes("10:20", "10:00")).toThrow();
expect(aggregateMonth([
  { id: "a", date: "2026-09-02", kind: "partial", startTime: "10:00", endTime: "10:20", note: "queda", authorId: "u" },
  { id: "b", date: "2026-09-03", kind: "full_day", startTime: null, endTime: null, note: "offline", authorId: "u" }
], 2026, 9)).toMatchObject({
  affectedDays: 2, fullDays: 1, partialDays: 1, interruptions: 1, unavailableMinutes: 1460
});
~~~

- [ ] **Step 2: Confirmar a falha**

Run: `pnpm vitest run tests/unit/incidents-domain.test.ts`
Expected: FAIL com módulos ausentes.

- [ ] **Step 3: Implementar tipos, validação e cálculo**

~~~ts
export type Incident = {
  id: string; date: string; kind: "partial" | "full_day";
  startTime: string | null; endTime: string | null;
  note: string; authorId: string;
};
export function calculateDurationMinutes(start: string, end: string): number;
export function aggregateMonth(items: Incident[], year: number, month: number): MonthlyMetrics;
export function buildMonthlySummary(metrics: MonthlyMetrics, locale?: "pt-BR"): string;
~~~

Conte dias inteiros como 1.440 minutos, não conte `full_day` como interrupção e calcule disponibilidade sobre todos os dias do mês.

- [ ] **Step 4: Rodar testes**

Run: `pnpm vitest run tests/unit/incidents-domain.test.ts`
Expected: PASS para duração, agregação, singular/plural, mês vazio e rejeição de horário invertido.

- [ ] **Step 5: Registrar**

Run: `git add features/incidents tests/unit/incidents-domain.test.ts && git commit -m "feat: add incident metrics domain"`

---

### Task 3: Calendário mensal e painel do dia

**Files:**
- Create: `components/calendar/month-calendar.tsx`
- Create: `components/calendar/calendar-day.tsx`
- Create: `components/calendar/day-panel.tsx`
- Create: `components/calendar/incident-form.tsx`
- Create: `components/metrics/month-metrics.tsx`
- Create: `app/(private)/calendar/page.tsx`
- Test: `tests/unit/month-calendar.test.tsx`
- Test: `tests/unit/incident-form.test.tsx`

**Interfaces:**
- Consumes: `Incident`, `MonthlyMetrics`, `aggregateMonth` e `buildMonthlySummary`.
- Produces: `MonthCalendar`, `DayPanel`, `IncidentForm` e `MonthMetrics`.

- [ ] **Step 1: Escrever testes de interação**

~~~tsx
render(<MonthCalendar year={2026} month={9} incidents={fixtures} onSelectDay={selectDay} />);
expect(screen.getByLabelText("3 de setembro, indisponível durante todo o dia")).toHaveAttribute("data-state", "full-day");
expect(screen.getByLabelText("2 de setembro, 1 interrupção, 20 minutos")).toHaveAttribute("data-state", "partial");
await user.click(screen.getByText("2"));
expect(selectDay).toHaveBeenCalledWith("2026-09-02");
~~~

- [ ] **Step 2: Confirmar a falha**

Run: `pnpm vitest run tests/unit/month-calendar.test.tsx tests/unit/incident-form.test.tsx`
Expected: FAIL com componentes ausentes.

- [ ] **Step 3: Implementar a menor tela reconhecível**

Crie cabeçalho do mês, botões anterior/próximo/hoje, sete colunas próprias, células escuras, parcial em âmbar e dia inteiro em vermelho. A primeira viewport deve mostrar calendário, métricas e ação “Registrar ocorrência”.

- [ ] **Step 4: Implementar o painel do dia**

`IncidentForm` alterna entre `partial` e `full_day`. Parcial exige início, fim e anotação; dia inteiro exige anotação e oculta horários. O painel lista várias ocorrências e oferece editar/excluir conforme permissões.

- [ ] **Step 5: Validar a primeira prévia e registrar**

Run: `pnpm vitest run tests/unit/month-calendar.test.tsx tests/unit/incident-form.test.tsx`
Expected: PASS.

Inicie `pnpm dev`, confirme que `/calendar` renderiza sem erro bloqueante e abra a única prévia local após o critério de primeira tela significativa.

Run: `git add app components tests && git commit -m "feat: build F1 monthly calendar workspace"`

---

### Task 4: Schema Supabase e Row Level Security

**Files:**
- Create: `supabase/migrations/202609110001_schema.sql`
- Create: `supabase/migrations/202609110002_security.sql`
- Create: `supabase/tests/rls.test.sql`
- Create: `docs/supabase-setup.md`

**Interfaces:**
- Produces: tabelas `profiles`, `permissions` e `incidents`; função `public.current_profile()`; políticas por permissão.

- [ ] **Step 1: Escrever testes SQL de segurança**

~~~sql
select lives_ok($$ insert into public.incidents
  (incident_date, kind, start_time, end_time, note)
  values ('2026-09-02','partial','10:00','10:20','queda') $$,
  'membro com can_create cria');
select throws_ok($$ delete from public.incidents where note='queda' $$,
  '42501', null, 'membro sem can_delete não exclui');
~~~

- [ ] **Step 2: Criar o schema**

`profiles` contém `id`, `full_name`, `status` e `role`. `permissions` contém `can_view`, `can_create`, `can_edit`, `can_delete` e `can_manage_users`. `incidents` contém data, tipo, horários, duração gerada, anotação, autor e timestamps.

- [ ] **Step 3: Criar constraints e RLS**

Garanta no banco: parcial possui horários válidos; dia inteiro não possui horários; não existe dia inteiro junto de registros parciais na mesma data; owner tem acesso total; membros dependem das permissões.

- [ ] **Step 4: Rodar testes locais**

Run: `npx supabase db reset`
Expected: migrations aplicadas.

Run: `npx supabase test db`
Expected: todos os testes RLS passam.

- [ ] **Step 5: Registrar**

Run: `git add supabase docs/supabase-setup.md && git commit -m "feat: secure F1 incidents in Supabase"`

---

### Task 5: Autenticação e ciclo de solicitação de acesso

**Files:**
- Create: `lib/env.ts`
- Create: `lib/supabase/browser.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`
- Create: `features/auth/schemas.ts`, `features/auth/actions.ts`, `features/auth/guards.ts`
- Create: `components/auth/login-form.tsx`, `components/auth/register-form.tsx`
- Create: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`
- Create: `app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/page.tsx`
- Create: `app/auth/callback/route.ts`, `app/(private)/layout.tsx`, `app/(private)/pending/page.tsx`
- Create: `proxy.ts`
- Test: `tests/unit/auth.test.ts`

**Interfaces:**
- Produces: `login(formData)`, `register(formData)`, `requestPasswordReset(formData)`, `updatePassword(formData)`, `logout()` e `requireApprovedUser()`.

- [ ] **Step 1: Escrever testes de guardas**

~~~ts
expect(resolveAccess({ status: "approved", can_view: true })).toBe("allow");
expect(resolveAccess({ status: "pending", can_view: true })).toBe("pending");
expect(resolveAccess({ status: "suspended", can_view: true })).toBe("deny");
~~~

- [ ] **Step 2: Confirmar a falha**

Run: `pnpm vitest run tests/unit/auth.test.ts`
Expected: FAIL com guardas ausentes.

- [ ] **Step 3: Implementar Supabase SSR e ações**

Use cookies para sessão, Zod para formulários e `SUPABASE_SERVICE_ROLE_KEY` apenas em módulos `server-only`. Novo cadastro cria perfil `pending`; login aprovado segue para `/calendar`; pendente segue para `/pending`.

- [ ] **Step 4: Recriar a experiência visual de login**

Use logotipo central, fundo espacial animado, campos escuros, mostrar/ocultar senha, botão dourado, “Esqueci minha senha” e “Solicitar novo acesso”, mantendo os textos do novo produto.

- [ ] **Step 5: Validar e registrar**

Run: `pnpm vitest run tests/unit/auth.test.ts`
Expected: PASS.

Run: `git add app components/auth features/auth lib proxy.ts tests/unit/auth.test.ts && git commit -m "feat: add approval-based authentication"`

---

### Task 6: Persistência das ocorrências

**Files:**
- Create: `features/incidents/repository.ts`
- Create: `features/incidents/actions.ts`
- Modify: `app/(private)/calendar/page.tsx`
- Modify: `components/calendar/day-panel.tsx`
- Test: `tests/unit/incidents-actions.test.ts`

**Interfaces:**
- Consumes: `Incident` e Supabase server client.
- Produces: `listIncidentsForMonth(year, month)`, `createIncident(input)`, `updateIncident(id, input)` e `deleteIncident(id)`.

- [ ] **Step 1: Escrever testes das ações**

~~~ts
await expect(createIncident(validPartial, memberWithCreate)).resolves.toMatchObject({ ok: true });
await expect(createIncident(validPartial, memberWithoutCreate)).resolves.toMatchObject({ ok: false, code: "forbidden" });
await expect(createIncident(invertedTime, owner)).resolves.toMatchObject({ ok: false, code: "validation" });
~~~

- [ ] **Step 2: Confirmar a falha**

Run: `pnpm vitest run tests/unit/incidents-actions.test.ts`
Expected: FAIL com ações ausentes.

- [ ] **Step 3: Implementar consultas e mutações**

Todas as ações validam sessão, status, permissão e entrada. Depois da escrita, execute `revalidatePath("/calendar")`. Retorne erros tipados sem expor detalhes do banco.

- [ ] **Step 4: Conectar a interface**

A página consulta somente o intervalo do mês solicitado. O painel preserva dados quando houver erro, mostra confirmação de sucesso e recalcula métricas com o resultado persistido.

- [ ] **Step 5: Validar e registrar**

Run: `pnpm vitest run tests/unit/incidents-actions.test.ts tests/unit/incidents-domain.test.ts tests/unit/month-calendar.test.tsx`
Expected: PASS.

Run: `git add app components/calendar features/incidents tests && git commit -m "feat: persist calendar incidents"`

---

### Task 7: Administração de usuários e permissões

**Files:**
- Create: `features/users/types.ts`, `features/users/schemas.ts`, `features/users/actions.ts`
- Create: `components/users/users-panel.tsx`, `components/users/user-editor.tsx`
- Create: `app/(private)/admin/users/page.tsx`
- Create: `app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts`
- Modify: `components/layout/app-header.tsx`
- Test: `tests/unit/users-admin.test.tsx`

**Interfaces:**
- Produces: `listUsers()`, `updateUserStatus(id, status)`, `updateUserPermissions(id, permissions)` e `deleteUser(id)`.

- [ ] **Step 1: Escrever testes do painel**

~~~tsx
render(<UsersPanel users={[pendingUser]} currentUser={owner} />);
expect(screen.getByText("Pendente")).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "Editar Gilson" }));
expect(screen.getByLabelText("Pode criar ocorrências")).toBeInTheDocument();
~~~

- [ ] **Step 2: Confirmar a falha**

Run: `pnpm vitest run tests/unit/users-admin.test.tsx`
Expected: FAIL com painel ausente.

- [ ] **Step 3: Implementar administração segura**

Mostre busca, filtros por status, contagens e editor de permissões. Apenas owner ou usuário com `can_manage_users` acessa a tela e APIs; ninguém remove ou suspende o último owner.

- [ ] **Step 4: Conectar navegação e feedback**

Exiba “Usuários” no cabeçalho apenas para quem administra usuários. Confirme exclusões e apresente sucesso/erro sem recarregar formulários desnecessariamente.

- [ ] **Step 5: Validar e registrar**

Run: `pnpm vitest run tests/unit/users-admin.test.tsx tests/unit/auth.test.ts`
Expected: PASS.

Run: `git add app components features/users tests && git commit -m "feat: manage access requests and permissions"`

---

### Task 8: WebMCP, fluxo completo e entrega local

**Files:**
- Create: `app/.well-known/webmcp/route.ts`
- Create: `tests/e2e/calendar-flow.spec.ts`
- Create: `tests/e2e/helpers.ts`
- Create: `playwright.config.ts`
- Create: `README.md`
- Modify: `app/layout.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: todos os fluxos anteriores.
- Produces: produto local validado e instruções exatas de configuração.

- [ ] **Step 1: Expor ferramentas estruturadas do fluxo principal**

Registre ferramentas WebMCP para consultar o mês e registrar ocorrência, exigindo a mesma sessão, validação e permissões das Server Actions.

- [ ] **Step 2: Escrever o fluxo E2E**

~~~ts
// tests/e2e/helpers.ts
import type { Page } from "@playwright/test";

export async function loginAsOwner(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_OWNER_EMAIL!);
  await page.getByLabel("Senha").fill(process.env.E2E_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
}
export async function approvePendingMember(page: Page) {
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Editar Membro pendente" }).click();
  await page.getByLabel("Status").selectOption("approved");
  await page.getByRole("button", { name: "Salvar" }).click();
}
export async function createPartialIncident(page: Page, date: string, start: string, end: string, note: string) {
  await page.getByTestId("calendar-day-" + date).click();
  await page.getByRole("button", { name: "Registrar ocorrência" }).click();
  await page.getByLabel("Início").fill(start);
  await page.getByLabel("Fim").fill(end);
  await page.getByLabel("Anotação").fill(note);
  await page.getByRole("button", { name: "Salvar ocorrência" }).click();
}

// tests/e2e/calendar-flow.spec.ts
test("admin aprova membro e calendário agrega várias ocorrências", async ({ page }) => {
  await loginAsOwner(page);
  await approvePendingMember(page);
  await createPartialIncident(page, "2026-09-02", "10:00", "10:20", "Primeira parada");
  await createPartialIncident(page, "2026-09-02", "14:00", "14:15", "Segunda parada");
  await expect(page.getByText("2 interrupções")).toBeVisible();
  await expect(page.getByText("35 min")).toBeVisible();
});
~~~

- [ ] **Step 3: Verificar responsividade e acessibilidade**

Confira desktop e celular, zoom de texto a 200%, navegação por teclado, foco visível, nomes acessíveis, redução de movimento e ausência de rolagem horizontal inesperada.

- [ ] **Step 4: Rodar a verificação completa**

Run: `pnpm typecheck`
Expected: exit 0.

Run: `pnpm test`
Expected: todos os testes unitários passam.

Run: `pnpm test:e2e`
Expected: fluxos públicos e autenticados passam.

Run: `node C:\Users\gilso\.codex\plugins\cache\openai-curated-remote\sites\0.1.59\scripts\build-site.mjs`
Expected: build de produção concluído.

- [ ] **Step 5: Revisar no localhost e registrar**

Mantenha a prévia local aberta na mesma aba, teste login, solicitação, aprovação, permissões, múltiplas ocorrências, dia inteiro, edição, exclusão, métricas e resumo.

Run: `git add . && git commit -m "test: validate complete F1 calendar flow"`
