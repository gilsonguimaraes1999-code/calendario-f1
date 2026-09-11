# Supabase local — calendário F1

Estas migrations criam um banco novo para o calendário. Não vincule nem execute comandos contra o projeto de referência. A configuração versionada contém somente portas e identificação locais, sem credenciais ou referência remota.

## Requisitos e execução

Instale Docker Desktop com o mecanismo em execução e Node.js com npm/npx (ou o Supabase CLI). Na raiz deste projeto:

```sh
npx supabase start
npx supabase db reset --local
npx supabase test db
```

`db reset --local` apaga e recria **somente o banco local**. Não execute sobre dados locais que precise preservar. Quem já tiver o CLI pode substituir `npx supabase` por `supabase`. Não é necessário login, `link`, `db push`, chave de serviço remota ou acesso ao projeto externo. O arquivo `supabase/config.toml` já está presente; não é necessário `init`.

Os testes pgTAP ficam em uma transação com `ROLLBACK`: criam contas de exemplo, simulam os papéis `authenticated`/`anon`, verificam as políticas e descartam as alterações. `no_plan()` deixa `finish()` contar os testes efetivamente executados. Falhas SQL ou ausência de pgTAP não devem ser tratadas como aprovação.

## Configuração da autenticação da aplicação

Copie `.env.example` para `.env.local` apenas quando houver um projeto independente autorizado. Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `APP_URL` com a origem canônica da aplicação (por exemplo, `http://localhost:3000` no desenvolvimento). A chave de serviço fica somente em `SUPABASE_SERVICE_ROLE_KEY`; o cadastro e o login não precisam dela. O cliente administrativo é exclusivo do servidor e só deve ser chamado após autorização do usuário responsável.

No Auth desse projeto, configure a URL do site e permita os destinos `${APP_URL}/auth/callback` e `${APP_URL}/auth/callback?next=reset-password`. Mantenha a confirmação de e-mail habilitada e configure o remetente de mensagens antes de produção. Os links usam PKCE; abra a confirmação/recuperação no navegador que iniciou a solicitação, onde o cookie verificador foi criado. Um link expirado ou aberto em outro navegador retorna ao login com opção de solicitar nova recuperação. Verifique esse fluxo com o provedor real antes de publicar.

Sem configuração, as páginas públicas renderizam normalmente, os formulários retornam uma mensagem recuperável e as rotas privadas redirecionam para `/login`. Nenhum usuário de demonstração recebe acesso. A aprovação é independente da confirmação de e-mail: cadastros começam em `pending`, a aprovação exige o administrador, e membros aprovados também precisam de `can_view` para abrir o calendário. Rejeitados, suspensos e membros sem permissão veem seu estado em `/pending`. O proprietário mantém a exceção definida no RLS.

As rotas e ações do calendário chamam `requireApprovedUser()` e verificam a flag da operação; o layout privado verifica somente a sessão para permitir a tela de espera. A administração de usuários exige owner ou membro aprovado com `can_manage_users`, independentemente de `can_view`. A autorização final continua sendo aplicada pelo banco.

Execute os testes de navegador com o servidor local sem `.env.local` já ativo: `node node_modules/@playwright/test/cli.js test tests/e2e/auth.spec.ts --workers=1`. O teste usa o Microsoft Edge instalado; `AUTH_TEST_ORIGIN` permite informar outra origem local. Ele verifica composição em desktop/mobile, ausência de acesso anônimo e recuperação do formulário sem configuração.

## Contrato do banco

A migration `202609110003_incident_visibility.sql` acrescenta `can_view_all`, inicialmente `false`. Após sua aplicação, membros com `can_view` veem apenas ocorrências cujo `author_id` é o próprio usuário; `can_view_all` permite incluir todos os autores e registros históricos sem autor. O proprietário continua vendo todos. Edição e exclusão exigem suas flags **e** acesso à ocorrência: conhecer o UUID não permite alterar uma ocorrência oculta. `can_view_all` sozinho não concede criação/edição/exclusão. A aprovação continua obrigatória para membros. O teste complementar `supabase/tests/incident_visibility.test.sql` verifica esses casos.

O calendário consulta somente o mês solicitado, em páginas de 500 registros, usando a sessão SSR e filtros de autoria além do RLS. Ações aceitam apenas campos de ocorrência; autor, ID e timestamps continuam definidos pelo banco. As mutações conferem a linha retornada antes de confirmar sucesso, revalidam `/calendar`, e a interface recalcula as métricas somente a partir do retorno persistido. Erros preservam o formulário; falhas de leitura escondem as métricas até uma tentativa bem-sucedida. “Atualizar mês” busca novamente dados e permissões. A URL `/calendar?month=2026-09` permite abrir um mês específico; a navegação mensal em tela consulta o servidor sem recarregar a página.

| Tabela | Campos principais |
| --- | --- |
| `profiles` | `id` = UUID de `auth.users`, `full_name`, `status` (`pending`, `approved`, `rejected`, `suspended`), `role` (`member`, `owner`), timestamps |
| `permissions` | `profile_id` = UUID de `profiles`, seis flags `can_view`, `can_view_all`, `can_create`, `can_edit`, `can_delete`, `can_manage_users`; todas começam em `false` |
| `incidents` | `id`, `incident_date`, `kind`, `start_time`, `end_time`, `duration_minutes` gerado, `note`, `author_id`, timestamps |

`public.current_profile()` retorna o perfil do usuário autenticado, inclusive antes da aprovação, ou `NULL` quando ele não existe. As flags são consultadas em `permissions` pelo `profile_id`. As funções de autorização estão no schema `private`, que não deve ser incluído nos schemas expostos pela API.

No cadastro pelo Auth, um trigger cria o perfil `pending`/`member` e as permissões negadas. Somente `full_name` é copiado dos metadados fornecidos pelo usuário; nenhum papel, estado ou flag é aceito deles. Um membro sem perfil ou sem linha de permissões não recebe acesso operacional. As migrations destinam-se a um projeto novo: não fazem backfill de usuários anteriores à instalação do trigger.

O `owner` tem todas as permissões efetivas, independentemente das flags, de uma linha de permissões ausente ou do estado do perfil. Para membros, cada operação exige `approved` e sua respectiva flag. Edição e exclusão também exigem `can_view`, para que dados ocultos não possam ser alterados. Uma criação sem `can_view` pode ser feita sem `RETURNING`; pedir a representação da linha também requer acesso de leitura.

## Administração de usuários

A migration `202609110004_user_administration.sql` cria `list_access_users`, `update_access_user` e `delete_access_user`. São RPCs `SECURITY DEFINER` com `search_path` vazio, acesso revogado para `PUBLIC`/`anon` e autorização explícita pelo JWT em cada chamada. O app utiliza a sessão SSR do administrador; não utiliza a chave de serviço. A leitura retorna somente ID, nome, e-mail, perfil, status e seis flags, em páginas de 500 usuários.

Alterações de nome, status e permissões são uma única transação. O banco bloqueia linhas de perfil/permissões do autor da ação e do alvo em ordem estável antes de conferir a autorização; isso impede que uma revogação concorrente passe despercebida. A própria conta e todas as contas owner são imutáveis pelo painel/RPC, uma proteção mais forte que apenas contar o último owner. Não há promoção/rebaixamento por esta API. A gestão confiável do primeiro owner permanece fora da aplicação.

`/admin/users` possui busca, filtros e contagens, aprovação rápida (libera a própria visualização), edição granular das seis flags, rejeição, suspensão e reaprovação. Ações de calendário exigem `can_view`; `can_view_all` amplia o alcance, mas não cria poderes de escrita. O atalho “Usuários” aparece somente para administradores autorizados. A aprovação pelo editor não inventa permissões: revise os cartões antes de salvar. Sem `can_view`, um membro aprovado poderá administrar usuários caso tenha essa permissão, mas não abrir o calendário.

A exclusão usa `delete_access_user` para remover `auth.users` e suas dependências na mesma transação. Ocorrências ficam preservadas com `author_id = NULL`. Nenhuma conta foi excluída durante esta implementação. Antes de implantação, valide localmente os privilégios do proprietário da migration sobre `auth.users`, os cascades do Auth e a exclusão com sessões existentes; cada ação da aplicação volta a validar o usuário com `getUser()`.

API: `GET /api/admin/users`; `PATCH /api/admin/users/[id]` com os campos estritos `full_name`, `status` e/ou `permissions`; `DELETE /api/admin/users/[id]`. Todas exigem sessão e permissão, retornam `Cache-Control: no-store` e mensagens seguras. PATCH/DELETE exigem `Origin` igual a `APP_URL` (ou à origem da requisição no desenvolvimento sem configuração). Configure `APP_URL` canônico antes de produção. As Server Actions possuem também a checagem de origem do Next.

“Atualizar” refaz a leitura sem esconder falhas; mudanças só aparecem após confirmação do servidor. Não há realtime/polling. Uma edição aberta em outra sessão pode estar desatualizada; use Atualizar antes de editar. A autorização é sempre reavaliada no servidor/banco, independentemente do estado exibido. O teste `supabase/tests/users_admin.test.sql` cobre autorização, transições, proteção owner/self, validação e cascades; sua execução ainda depende do runtime local autorizado.

Os membros veem seu próprio perfil e suas flags. Um administrador de usuários aprovado vê o diretório e pode alterar/excluir outros membros e definir suas permissões; não modifica seu próprio acesso, não altera um `owner` e não promove alguém a `owner`. O principal pode administrar todos os membros. Desativação, rebaixamento ou exclusão de qualquer `owner` exige administração confiável fora do painel e das RPCs; essa regra conservadora também evita remover o último principal em operações concorrentes. `service_role` é confiável e ignora RLS; não o utilize para contornar essas proteções.

Inserções/edições de ocorrência aceitam somente `incident_date`, `kind`, `start_time`, `end_time` e `note`. ID, autor, duração e timestamps vêm do banco. O cliente não pode forjar esses campos. `author_id` fica `NULL` após a exclusão de um membro, preservando ocorrências históricas; a aplicação deve apresentar esse caso como autor removido. Excluir apenas `profiles` não exclui a conta Auth; por isso a RPC administrativa remove a conta Auth e deixa as FKs realizarem os cascades.

## Regras de ocorrências

Parciais exigem início e fim na mesma data, em minutos inteiros (`HH:MM`), com início menor que fim; `24:00`, segundos e horários ausentes são recusados. Dia inteiro exige ambos os horários `NULL` e gera 1.440 minutos. Anotação vazia ou somente com espaços, tabulação ou quebra de linha é recusada.

A exclusão GiST `(incident_date WITH =, kind WITH <>)` proíbe tipos diferentes na mesma data, inclusive em inserções concorrentes. Um índice único parcial proíbe dois registros `full_day` na mesma data. Várias parciais, inclusive com sobreposição de horários, são válidas. As regras valem também para alterações de data/tipo e para o principal. Essa combinação usa o suporte a `<>` da extensão oficial [btree_gist do PostgreSQL](https://www.postgresql.org/docs/17/btree-gist.html).

Erros úteis para a camada de persistência: `23514` = dados inválidos; `23P01` = tipos incompatíveis na data; `23505` = dia inteiro duplicado; `42501` = permissão negada. `UPDATE` e `DELETE` bloqueados por RLS normalmente afetam **zero linhas**, sem lançar erro: solicite `RETURNING id`/`.select('id')` e confira que exatamente um registro mudou antes de confirmar sucesso. Nunca converta uma resposta vazia em sucesso de gravação.

## Primeiro principal local

Crie a conta pelo Auth local. Depois, com a conexão administrativa **local**, use o UUID dessa conta:

```sql
update public.profiles
set role = 'owner', status = 'approved'
where id = '<UUID da conta Auth local>'::uuid;
```

Não há senha padrão, e-mail privilegiado nem promoção automática pelo primeiro cadastro. A chave `service_role` pertence exclusivamente ao servidor e não deve aparecer em variáveis `NEXT_PUBLIC_*`.

## Verificação de concorrência antes da publicação

Além do pgTAP transacional, valide com duas conexões locais administrativas. Na conexão A, execute `BEGIN` e insira uma parcial em uma data vazia, informando um autor local. Na conexão B, tente inserir um dia inteiro na mesma data. A segunda inserção deve aguardar A; depois de `COMMIT` em A, B deve falhar com `23P01`. Repita na ordem inversa e com duas inserções de dia inteiro (a segunda deve falhar com `23505`). Use datas de teste e remova somente essas linhas após a verificação. Nenhum teste de concorrência multissessão foi executado neste ambiente sem PostgreSQL/Docker.

## Estado de validação desta entrega

O ambiente de implementação não dispõe de `npx`, Supabase CLI, Docker ou PostgreSQL/`psql`. As tentativas `npx supabase test db` e `npx supabase db reset` não iniciaram porque `npx` não foi encontrado. Portanto, não há RED/GREEN SQL observado nem migrations aplicadas em banco nesta entrega. Execute os comandos locais acima antes de integrar a persistência ou publicar. Nenhum projeto Supabase externo foi alterado.
