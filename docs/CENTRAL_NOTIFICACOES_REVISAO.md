# Central de notificações — proposta em revisão

Esta branch contém a **Etapa A: notificações internas**. Não contém Web Push,
WhatsApp automático nem e-mail. Não está aprovada para publicação.

## Regras de negócio

| Operação realizada | Notificação criada para |
| --- | --- |
| Cliente envia solicitação | Prestador selecionado |
| Prestador responde | Cliente |
| Prestador aceita | Cliente |
| Prestador recusa | Cliente |
| Prestador conclui | Cliente |
| Cliente cancela | Prestador |

Uma solicitação é criada junto com sua notificação em **uma transação**.
As transições de status usam atualização condicional (CAS) para evitar
alterações concorrentes e notificações inconsistentes. Existe índice único
por destinatário, solicitação e tipo para evitar avisos repetidos.

**Não incluir dados pessoais sensíveis em títulos ou mensagens.**
A central permite ver somente notificações vinculadas ao ID obtido do
token autenticado; nenhum cliente pode consultar notificações de outro.

## Descobertas da inspeção do Supabase real (2026-11-03)

- Projeto da organização Lartop: plano gratuito, **sem backup automático diário**
  (documentação oficial recomenda `supabase db dump` para exportar off-site).
- Os arquivos de migração Prisma estão no repositório, mas a tabela
  `_prisma_migrations` **não existe** no banco atual. Portanto,
  **NÃO EXECUTAR `prisma migrate deploy` no banco real**: ele tentaria
  executar a migração inicial sobre tabelas existentes.
- O schema atual tem 12 tabelas `public` com RLS desativado; o
  Supabase confirmou permissões `anon` e `authenticated` de SELECT/INSERT.
  Esse é um risco crítico pré-existente que deve ser tratado em plano próprio,
  **sem ativar RLS em massa** antes de testar a compatibilidade da aplicação.
- A nova tabela de notificações é criada **com RLS ativado e grants
  revogados para PUBLIC, anon e authenticated**; só o backend com conexão
  privilegiada deve acessá-la.
- O conector atual não oferece download de backup nem recuperação
  verificável. **Não aplicar nova migração nem mesclar esta PR sem um
  backup externo recuperável** e sem comparar roles/estrutura com a API real.

## Migração do Supabase

**Não aplicar em produção antes da revisão.** Nova migração:
`apps/api/prisma/migrations/20261103233000_add_notificacoes/migration.sql`.

A migração adiciona somente a tabela `notificacoes` e o enum
`TipoNotificacao`. Não reescreve pedidos, usuários ou avaliações.

**Revisão do histórico no repositório:** as migrações já incluem a tabela
`refresh_tokens` na migração inicial, a coluna `tamanho_m2`, o campo
`categorias.ativo`, os eventos de análise e os tokens de recuperação.
Essa verificação confirma os arquivos no GitHub, **não** a equivalência
com o banco Supabase real. Antes de rodar `prisma migrate deploy` em
produção, verificar `_prisma_migrations` no Supabase, comparar o estado
real e confirmar backup/restauração.
A implantação exige esta ordem: 1) validar e aplicar migração no ambiente
de homologação; 2) testar API; 3) migrar produção com backup; 4) implantar
API e frontend na mesma janela controlada. Não publicar o código da API
antes de criar a tabela nova, pois novos pedidos poderiam falhar.

## Verificações obrigatórias antes de liberar

1. Criar duas contas de teste: cliente e prestador, com CEP válido.
2. Criar pedido e verificar exatamente 1 notificação para prestador.
3. Verificar que cliente não pode ler a notificação do prestador (404).
4. Testar resposta, aceite, recusa e conclusão, com avisos apenas ao cliente.
5. Testar cancelamento pelo cliente com aviso ao prestador.
6. Simular duas atualizações simultâneas: apenas uma pode vencer.
7. Simular falha na gravação da notificação: a transação deve reverter.
8. Marcar uma notificação como lida, depois todas; verificar contagem.
9. Testar usuário sem login, token expirado e usuário bloqueado.
10. Abrir sino no celular e computador; validar que não cobre controles.
11. Simular Redis temporariamente indisponível; conferir comportamento da API.
12. Validar build e testes em um PostgreSQL descartável: `pnpm --filter @lartop/api build`,
    `pnpm --filter @lartop/api test:notificacoes`,
    `pnpm --filter @lartop/api test:notificacoes:integration`.
13. Verificar o build do frontend na prévia da Vercel e a tipagem em CI (gerando primeiro as rotas com `next typegen`).
14. Validar a correspondência das migrations com o Supabase real **somente
    após inspeção separada, com acesso administrativo autorizado**.

## Validação automatizada

O frontend renderiza uma única instância do sino por usuário (sem pesquisas duplicadas no layout responsivo).

O workflow `.github/workflows/notificacoes-revisao.yml` executa instalação,
geração do Prisma, migração em **PostgreSQL 16 descartável** e testes que
abrangem: criação, aviso ao destinatário correto, leitura autorizada,
negação de terceiros, mudança de status, rejeição de duplicatas,
concorrência e rollback transacional.

As credenciais de teste são fictícias e o script de integração bloqueia
conexões fora de `localhost` ou `127.0.0.1`. Nenhuma migração de CI
acessa o banco Supabase real.

O teste só pode ser marcado como aprovado quando o check do workflow
aparecer verde no PR. Uma compilação verde da Vercel não substitui os
testes reais da API e de migração.

## Possível rollback

Não excluir a tabela `notificacoes` para efetuar rollback. Desativar
o consumo e a gravação de avisos via versão anterior da API/frontend.
Preservar registros para análise. Não há rotina automática de limpeza.

## Limitações desta etapa

- O sino consulta a API a cada 30 segundos enquanto a página está visível
  e quando a aba volta ao foco.
- O aviso **não** chega com o site fechado; isto será tratado por Web Push.
- A lista mostra os 15 avisos mais recentes (histórico integral permanece
  armazenado no banco).
- A liberação precisa da aprovação e de testes de ponta a ponta.
