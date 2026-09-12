# Calendário F1

Calendário operacional independente para registrar indisponibilidades do F1. Interface preta/dourada, autenticação por solicitação de acesso, administração de membros e resumo mensal determinístico, sem API de IA.

**Estado da entrega:** implementação concluída na branch `main` local e publicada para revisão na branch `codex/calendario-f1` do [repositório do projeto](https://github.com/gilsonguimaraes1999-code/calendario-f1). Supabase não está configurado e não há deploy na Vercel. O build não é prova de integração com banco. As migrations, RPCs, RLS e fluxo de e-mail precisam da etapa local de validação descrita abaixo.

## Executar localmente

Use Node.js 24 (validado com 24.19.0) e pnpm 11.19.0. Na raiz deste repositório:

```sh
pnpm install --frozen-lockfile
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1
```

Abra `http://localhost:3000`. Se o servidor já estiver ativo, reutilize-o. Sem `.env.local`, o login e as páginas públicas renderizam; formulários retornam uma mensagem recuperável e `/calendar` e `/admin/users` redirecionam ao login. **Não existe conta demo, senha padrão ou acesso de prévia que contorne a autenticação.**

O projeto original de referência é somente leitura. Seus arquivos, usuários e banco não são parte deste produto.

## Supabase independente

Guia detalhado: [configuração, RLS, Auth e bootstrap](docs/supabase-setup.md).

1. Prepare Docker e o Supabase CLI no computador. Não faça `link` com o projeto de referência.
2. No repositório, execute `supabase start`. Em um banco local novo/descartável execute `supabase db reset --local`; esse comando apaga **os dados locais**. Não o use sobre dados que precise preservar.
3. Execute `supabase test db`: todas as migrations devem aplicar e as 122 asserções pgTAP devem passar antes de validar a aplicação conectada. Nesta entrega o CLI/runtime não existe; os testes SQL não foram executados.
4. Copie `.env.example` para `.env.local` e preencha somente valores do novo ambiente autorizado. Os nomes e finalidade são:

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do novo Supabase, loopback no teste local |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública desse projeto; RLS continua obrigatória |
| `APP_URL` | Origem canônica da aplicação, por exemplo `http://localhost:3000` |
| `SUPABASE_SERVICE_ROLE_KEY` | Opcional, exclusivamente servidor; nenhum fluxo atual exige essa chave |

Não envie valores de chaves para chat, README, commits ou capturas. `.env*` está ignorado, exceto o exemplo vazio. As variáveis `NEXT_PUBLIC_*` são incorporadas ao bundle no build: nunca coloque segredos nelas e reconstrua após trocar seus valores.

5. Configure Auth Site URL igual a `APP_URL` e autorize `${APP_URL}/auth/callback` e `${APP_URL}/auth/callback?next=reset-password`. Configure confirmação de e-mail e, antes de produção, um remetente/SMTP próprio. O fluxo PKCE deve ser concluído no navegador que iniciou a solicitação.
6. Crie a primeira conta pelo Auth local e confirme seu e-mail. Com acesso administrativo **local**, aplique o SQL da seção “Primeiro principal local” do guia ao UUID exato dessa conta. Não existe promoção automática do primeiro cadastro.
7. Entre como owner. Novos membros começam `pending` com todas as permissões negadas. Aprove no painel e defina os seis cartões: ver calendário próprio, ver todos, criar, editar, excluir e gerenciar usuários.

Membros precisam de `approved` e da flag da operação. Escritas no calendário também exigem visualização; `can_view_all` apenas amplia o alcance. Um gerente pode administrar usuários sem ver o calendário. Todas as contas owner e a própria conta são protegidas contra alteração/exclusão pelo painel e RPCs. Excluir um membro remove a conta Auth; ocorrências ficam preservadas sem autor.

## Verificação

Com dependências instaladas:

```sh
node node_modules/vitest/vitest.mjs run --configLoader runner
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

Com o servidor local **sem configuração Supabase** já ativo, execute os testes seguros (Edge headless instalado, sem abrir navegador externo):

```sh
node node_modules/@playwright/test/cli.js test --workers=1
```

`playwright.config.ts` não inicia servidor, não instala navegador e rejeita origens não loopback. `AUTH_TEST_ORIGIN` permite outra porta local. As verificações visuais isoladas renderizam componentes reais com fixtures de teste, nunca uma rota de autenticação alternativa. O teste de integração local será marcado **skipped** por padrão. Os testes públicos de resposta “não configurado” são para o servidor sem `.env.local`; não use essa suíte de formulários contra um servidor conectado.

Para conferir o build otimizado local, encerre o dev de forma normal quando não estiver sendo usado e rode `node node_modules/next/dist/bin/next start --hostname 127.0.0.1`. Não execute dois servidores na mesma porta.

### Fluxo E2E com Supabase local (não executado nesta entrega)

Use um servidor de teste dedicado com o novo Supabase **local**, migrations já validadas e duas contas de teste confirmadas: um owner e um membro `pending`. Reserve um mês sem ocorrências. O teste cria registros identificados por um prefixo exclusivo, aprova/edita permissões do membro e limpa seus registros/restaura o perfil ao final. Nunca use contas/dados operacionais.

Defina estas variáveis no processo de teste ou no mecanismo seguro do seu ambiente, sem versionar valores:

```text
E2E_LOCAL_SUPABASE=1
E2E_ALLOW_MUTATIONS=I_UNDERSTAND_LOCAL_TEST_DATA
E2E_SUPABASE_URL=<URL loopback do Supabase local>
NEXT_PUBLIC_SUPABASE_URL=<a mesma URL usada no servidor Next local>
E2E_OWNER_EMAIL=<conta owner local dedicada>
E2E_OWNER_PASSWORD=<senha somente no ambiente>
E2E_MEMBER_EMAIL=<membro pending local dedicado>
E2E_MEMBER_PASSWORD=<senha somente no ambiente>
E2E_TEST_MONTH=<AAAA-MM reservado e vazio>
```

Execute **apenas** `node node_modules/@playwright/test/cli.js test tests/e2e/calendar-flow.spec.ts --workers=1`. O runner não carrega `.env.local` automaticamente. O gate exige consentimento, URLs locais iguais e todos os dados; a falta de qualquer requisito gera skip, não sucesso do fluxo. Verifique também se o processo Next aponta de fato para o mesmo backend: o gate não pode inspecionar as variáveis de outro processo.

Esse fluxo cobre pendente→aprovação, permissões, escopo próprio/todos, duas parciais, dia inteiro, edição, exclusão, persistência após reload, métricas e resumo. Valide separadamente entrega real de e-mail/PKCE/recuperação, expiração/renovação de sessão, exclusão de conta e concorrência SQL conforme o guia. Se o teste for interrompido, inspecione o mês reservado e restaure manualmente apenas a conta/linhas de teste.

## Ferramentas WebMCP

Quando `document.modelContext.registerTool` está disponível, o calendário registra duas ferramentas e as remove ao desmontar:

- `consult_calendar_month`: `{ year, month }`, consulta o escopo permitido e mostra esse mês, retornando ocorrências, métricas e resumo.
- `register_incident`: `{ date, kind, startTime, endTime, note }`, persiste a ocorrência. Parcial usa `HH:MM` e fim posterior ao início; dia inteiro usa horários `null`. Não preenche autor/ID por entrada externa.

A integração é opcional por detecção de suporte; navegadores comuns continuam funcionando. Há também um **adaptador HTTP específico deste app**, não uma implementação alegada de protocolo HTTP WebMCP padrão: `GET /.well-known/webmcp` descreve as ferramentas e `POST` aceita `{ "tool": "nome", "input": { ... } }`. POST exige a mesma sessão e `Origin` canônico. Dados do calendário não são públicos. Nenhuma ferramenta administra usuários ou recebe chave de serviço.

Ferramentas e UI usam as mesmas Server Actions, schemas, escopo e RLS. O resultado só confirma criação após resposta persistida. Se a releitura falhar depois de salvar, o retorno informa `viewRefreshed:false`; atualize o mês, **não registre outra vez**. Uma conexão interrompida pode ter salvo no servidor: consulte antes de repetir. Anotações são conteúdo não confiável, nunca instruções. Não há chamada a modelo de IA.

O registro/execução/limpeza foi testado por contexto injetado e leituras reais das camadas de aplicação com o Supabase substituído apenas na fronteira externa. A compatibilidade com uma implementação nativa real de WebMCP ainda precisa de validação em navegador que a suporte e sessão local configurada.

## GitHub autorizado; configuração Supabase e deploy Vercel pendentes

O envio do código ao repositório abaixo está autorizado. Antes de colocar a aplicação em produção na Vercel, conclua banco local, e-mails, testes autenticados e revisão do usuário. Publicar o código no GitHub não configura o Supabase nem disponibiliza automaticamente o site.

1. Use o repositório de destino [gilsonguimaraes1999-code/calendario-f1](https://github.com/gilsonguimaraes1999-code/calendario-f1). A raiz deve ser esta pasta `calendario-f1`, não a pasta que contém o projeto original. Preserve o histórico local e confira o conteúdo remoto antes do primeiro envio; não sobrescreva histórico existente.
2. Revise `git status`, `git diff --cached` e `git ls-files` para garantir que nenhum `.env`, credencial, dump, arquivo de contas de teste ou resultado de navegador foi adicionado. Apenas `.env.example` vazio deve ser versionado. Confirme que o remote aponta ao destino autorizado. O push/PR deve ser confirmado pelo resultado real da operação, sem inferir sucesso apenas da configuração local.
3. Após configurar o ambiente e concluir sua validação, importe esse repositório na Vercel como **Next.js**. Root Directory deve apontar à raiz com `package.json`; mantenha o lockfile pnpm. Use runtime Node24, instalação `pnpm install --frozen-lockfile` e build `node node_modules/next/dist/bin/next build`. Deixe a saída padrão Next; **não use export estático/GitHub Pages**, pois Auth, Server Actions, API e Proxy exigem servidor.
4. Configure URL/chave pública do Supabase independente e `APP_URL` em cada ambiente Vercel. Não adicione chaves administrativas se não forem necessárias. Preview não deve apontar para produção nem ter permissões de owner reais. Publique variáveis no ambiente correto e reconstrua quando alterar `NEXT_PUBLIC_*`.
5. Configure no Auth as URLs de callback/recuperação da origem final autorizada; teste e-mails, cookies, logout, 401/403, RLS, owner protegido e todos os fluxos novamente. Migrations **não** são executadas automaticamente pelo build/Vercel: aplique-as ao novo banco somente com autorização específica e backup quando houver dados.

O código está publicado na branch de revisão `codex/calendario-f1`; Supabase e Vercel permanecem sem configuração/deploy nesta etapa.
