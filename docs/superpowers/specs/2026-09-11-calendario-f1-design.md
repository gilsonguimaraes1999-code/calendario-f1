# Calendário operacional do F1

## Objetivo

Criar um projeto novo e independente para registrar indisponibilidades do F1 em um calendário mensal, medir o impacto de cada mês e produzir um resumo automático sem serviços de inteligência artificial. O ZIP `solicitacoes-lucifer-e-lu-main` é apenas uma referência visual e funcional; seu projeto e banco não serão alterados.

## Identidade visual

O novo produto preservará os padrões reconhecíveis da referência: fundo preto com elementos espaciais, paleta dourada, superfícies escuras translúcidas, tipografia Inter e Outfit, campos e botões personalizados, foco dourado, cabeçalho compacto e comportamento responsivo. O calendário, os seletores e os diálogos serão componentes próprios da aplicação, sem aparência de controles nativos do Windows.

O estado visual dos dias será consistente:

- normal: superfície escura neutra;
- interrupção parcial: destaque dourado/âmbar;
- indisponibilidade durante todo o dia: destaque vermelho;
- dia selecionado: contorno claro e acessível, preservando a cor do estado.

## Estrutura do produto

O projeto será uma aplicação Next.js independente, preparada para Supabase, GitHub e Vercel. Terá três áreas principais:

1. Autenticação pública: entrar, solicitar acesso, recuperar senha e redefinir senha.
2. Área operacional: calendário mensal do F1, painel do dia, métricas e resumo do mês.
3. Administração: usuários, estados de conta e permissões individuais.

O primeiro ambiente de validação será o localhost. A conexão definitiva com Supabase e a publicação no GitHub/Vercel ocorrerão depois da validação local do produto.

## Autenticação e acessos

O Supabase Auth será usado com e-mail e senha e sessão segura por cookies. Uma pessoa poderá solicitar acesso publicamente, mas só entrará na área operacional depois da aprovação administrativa.

Cada perfil terá um estado entre `pending`, `approved`, `rejected` e `suspended`. O administrador principal poderá aprovar, rejeitar, suspender, reativar e excluir membros. Contas pendentes ou bloqueadas verão uma mensagem adequada e não acessarão os dados operacionais.

As permissões individuais serão:

- visualizar o calendário e as métricas;
- criar ocorrências;
- editar ocorrências;
- excluir ocorrências;
- administrar usuários e permissões.

O administrador principal sempre manterá todas as permissões. As regras também serão aplicadas no banco por Row Level Security, e não apenas escondidas na interface.

## Calendário e registros

A visualização inicial será o mês atual. O usuário poderá navegar entre meses e voltar ao mês atual. Cada célula mostrará o número do dia, estado operacional, quantidade de interrupções, duração acumulada e um indicativo quando existirem várias anotações.

Selecionar um dia abrirá um painel com a lista completa de ocorrências. O usuário autorizado poderá incluir várias ocorrências no mesmo dia. Cada ocorrência parcial terá horário inicial, horário final e anotação. A duração será calculada automaticamente. Para indisponibilidade total, haverá uma opção específica de dia inteiro e uma anotação.

As regras serão:

- horários finais devem ser posteriores aos horários iniciais;
- ocorrências parciais podem coexistir no mesmo dia;
- um dia marcado como totalmente indisponível não aceitará ocorrências parciais simultâneas;
- editar ou excluir registros recalculará imediatamente a célula, as métricas e o resumo;
- operações serão confirmadas pelo servidor antes de serem consideradas persistidas.

## Métricas e resumo automático

Para o mês selecionado, a aplicação calculará:

- quantidade de dias afetados;
- quantidade de dias totalmente indisponíveis;
- quantidade de dias com interrupções parciais;
- número total de interrupções;
- tempo acumulado de indisponibilidade parcial;
- disponibilidade estimada do período.

A disponibilidade estimada considerará 24 horas por dia do mês. Um dia inteiro contará como 1.440 minutos e os registros parciais contarão pela duração calculada. O banco impedirá que um mesmo dia seja contado simultaneamente como dia inteiro e parcial.

O resumo será determinístico e criado com modelos de texto baseados nas métricas. Exemplo: “Em setembro, o F1 apresentou falhas em 6 dias. Em 2 deles não funcionou durante todo o dia. Os outros 4 dias acumularam 3h40 de indisponibilidade, distribuídas em 9 interrupções.” Isso não usará API de IA nem gerará custo adicional.

## Modelo de dados

O banco terá tabelas próprias para perfis, permissões e ocorrências. Uma ocorrência registrará data operacional, tipo (`partial` ou `full_day`), início, fim, duração calculada, anotação, autor e datas de criação e alteração.

Constraints garantirão dados coerentes. Índices por data e autor tornarão a consulta mensal eficiente. As migrations serão versionadas junto ao novo projeto.

## Estados e tratamento de erros

As telas terão estados de carregamento, vazio, sucesso e erro. Falhas de rede ou autorização preservarão o formulário e explicarão o que não foi salvo. Exclusões exigirão confirmação. A interface impedirá ações não autorizadas, enquanto o servidor e o banco validarão novamente cada operação.

## Responsividade e acessibilidade

No desktop, calendário e métricas poderão aparecer lado a lado. No celular, as métricas ficarão em uma faixa compacta e o calendário manterá células tocáveis; os detalhes do dia abrirão em painel adaptado à largura. Todos os controles terão nomes acessíveis, foco visível, navegação por teclado, contraste adequado e suporte a redução de movimento.

## Verificação

Serão verificadas as regras de duração, agregação mensal, geração do resumo, permissões e estados de conta. Os principais fluxos serão validados no navegador: solicitar acesso, aprovar usuário, entrar, criar múltiplas ocorrências, marcar dia inteiro, editar, excluir e conferir a atualização das métricas. O projeto deverá passar por verificação de tipos, testes automatizados e build de produção antes da entrega local.

## Fora do escopo inicial

O primeiro lançamento acompanhará somente o F1. Não haverá cadastro de outros equipamentos, notificações, integração de IA, exportação de relatórios ou publicação antes da validação no localhost.
