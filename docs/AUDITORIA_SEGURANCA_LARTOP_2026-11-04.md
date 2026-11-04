# Lartop — Auditoria de segurança (04/11/2026)

> **Status:** revisão técnica, sem alteração de permissões no banco ou código
> publicado. O objetivo é conservar a operação atual até a mudança passar
> por testes e aprovação.

## Escopo e evidências

- Supabase, projeto associado ao Lartop: inspeção *somente leitura* de
  tabelas, roles, privilégios, RLS, índices, políticas, objetos, ACLs padrão
  e resultados dos *security advisors*.
- GitHub `main` na revisão: `903fd006a5c4911e058e668ee243afc0ccb93e7e`.
- Railway: conferência **apenas dos nomes** das variáveis; valores secretos
  foram ocultados, não copiados para este relatório.
- Código Fastify/Prisma/Next: autenticação, sessão, refresh, recuperação,
  autorização em rotas, frontend e upload.
- Não houve consulta a senhas, tokens, endereços nem a registros pessoais
  de usuários; não foi realizado teste ofensivo com dados reais.

## Achados confirmados

### S1 — CRÍTICO: 12 tabelas sem RLS e com privilégios públicos

As tabelas abaixo estão com RLS desativado e `anon` / `authenticated`
têm `SELECT`, `INSERT`, `UPDATE` e `DELETE` concedidos:

`usuarios`, `refresh_tokens`, `tokens_recuperacao_senha`,
`solicitacoes_orcamento`, `avaliacoes`, `categorias`, `cidades`,
`ceps`, `perfis_profissionais`, `profissional_categorias`,
`fotos_portfolio`, `eventos_analytics`.

Se a Data API do Supabase estiver habilitada e essas tabelas expostas,
as permissões permitem acesso direto sem passar pelas regras do Fastify.
Isso é risco de leitura, alteração de papéis, pedidos e dados de sessões.

*Fonte:* inspeção da ACL SQL e `get_advisors(type="security")`.
**Não foi testada a disponibilidade externa atual da Data API** e não há
evidências de exploração.

As novas tabelas `notificacoes` e `assinaturas_push` estão protegidas:
RLS ativo, `anon/authenticated` sem SELECT/INSERT/UPDATE/DELETE.

### S2 — CRÍTICO: ACLs padrão continuam concedendo acesso automático

Os *default privileges* de `postgres` e `supabase_admin` no esquema
`public` concedem permissões amplas às roles da API em tabelas,
funções e sequências. Qualquer nova tabela pode ser exposta sem uma
revogação explícita, mesmo que as duas novas tabelas tenham sido
protegidas manualmente.

### S3 — ALTO: refresh/logout não invalidam refresh JWT de verdade

Em `auth.service.ts`, `emitirTokens()` grava
`refresh:<jti>:<usuarioId>` no Redis, mas `renovarTokens()` apenas
valida assinatura/expiração do refresh JWT. Não consulta a sessão no
Redis e o `jti` não integra o token. `revogarSessao()` remove chaves
Redis que a renovação não lê.

**Correção proposta:** emitir JWT com identificador de sessão `jti`,
armazenar apenas hash, conferir registro ativo em Redis e promover
rotação atômica por refresh. Tratar tokens legados de forma planejada,
pois a correção pode exigir novo login.

### S4 — ALTO: bloqueio de conta não é verificado em todas as rotas

O middleware geral `exigirAutenticacao` valida JWT mas não consulta
`usuarios.ativo` nem `usuarios.tipo` atuais. Rotas de notificações
e push possuem proteção extra, mas outras rotas autenticadas podem ser
acessadas até vencer o JWT (por padrão 15 min).

**Correção proposta:** verificação uniforme, com testes para clientes,
prestadores, admin e contas desativadas; não confiar só em tipo embutido
num token antigo.

### S5 — ALTO: recuperação de senha não encerra sessões existentes

`redefinirSenha()` atualiza a senha e marca o token usado; não revoga
refresh tokens e access tokens antigos. Após redefinição, sessões
anteriores podem continuar funcionando.

**Correção proposta:** revogação global de sessões de refresh,
invalidação de tokens de recuperação remanescentes e mecanismo para
revogar acessos emitidos previamente.

### S6 — MÉDIO: endurecimento do frontend/sessão

`contentSecurityPolicy: false` em `seguranca.ts`.
O access token no navegador fica no `localStorage`. A combinação eleva
o impacto de uma eventual falha de XSS. Migrar sessão com cuidado:
CSP incremental, testes de scripts/fontes, cookies `HttpOnly` conforme
arquitetura e proteção CSRF quando aplicável.

### S7 — MÉDIO: URLs de recuperação podem estar incorretas

O código monta links com `process.env.FRONTEND_URL`, mas essa variável
não consta entre os nomes configurados no Railway. Conferir Resend,
origem permitida e endereços da aplicação antes de reabilitar e-mails.

### S8 — Operação e manutenção

- O projeto Supabase está no plano Free; não presumir backup automático.
- O banco real ainda não tem `_prisma_migrations` (Prisma), embora
  registre sua própria migração Supabase para assinaturas push.
- O Railway contém Redis, JWT, chaves VAPID e credenciais de banco com
  valores não legíveis via conector. Não foi validada rotação de segredos.
- Nenhuma tabela `public` de view ou função própria foi identificada;
  vale reavaliar isso após novas migrações.

## Aspectos positivos

- Senhas usam Argon2id.
- Limite de tentativas de login por conta e por IP via Redis.
- Rotas de solicitações verificam titularidade do pedido.
- Notificações e inscrições Web Push têm RLS e privilégios restritos.
- Inscrições push validam endpoints e rejeitam destinos locais.
- Dados de novos pedidos e avisos são gravados em transações.

## Correção prioritária proposta (não executada)

**Opção recomendada** se o frontend só conversar com a API própria:
desativar a Data API pelo Dashboard em
`https://supabase.com/dashboard/project/zjbhaovgwwjudtwiiglf/integrations/data_api/overview`
(desligar **Enable Data API**). Segundo a documentação oficial, isso
desliga endpoints REST gerados e não desliga conexões PostgreSQL
diretas da API Fastify/Prisma.

**Não aplicar cegamente**. Antes, confirmar ausência de uso da Data API
por clientes externos, scripts, integrações e páginas que não foram
inspecionadas; documentar procedimento de reversão.

**Defesa adicional**, sujeita a aprovação e testes: revogar privilégios
de `anon` e `authenticated` nas 12 tabelas existentes e também nos
*default privileges*, além de ativar RLS com políticas apropriadas
quando houver acesso via Data API. Não habilitar RLS em massa sem
identificar a role real do backend e executar cenários em homologação.

## Proposta SQL para revisão — NÃO EXECUTAR SEM APROVAÇÃO

```sql
-- Aplica apenas ao esquema public. O SQL abaixo está em revisão.
-- Primeiro confirmar quais consumidores da Data API existem.
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE
  public.usuarios,
  public.refresh_tokens,
  public.tokens_recuperacao_senha,
  public.solicitacoes_orcamento,
  public.avaliacoes,
  public.categorias,
  public.cidades,
  public.ceps,
  public.perfis_profissionais,
  public.profissional_categorias,
  public.fotos_portfolio,
  public.eventos_analytics
FROM anon, authenticated;

-- O criador postgres possui permissões padrão abrangentes.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

COMMIT;

-- Os padrões adicionais de supabase_admin exigem um plano de permissão
-- próprio. Não tentá-los com uma role que não seja autorizada.
```

Este SQL restringe *grants*, não habilita RLS nas 12 tabelas.
É complemento de defesa, não substituto de políticas de acesso quando
a Data API estiver ativa. Mudanças devem ter plano de rollback.

## Plano de validação e rollback

1. Confirmar conexão/role usada pelo Railway sem revelar credenciais.
2. Testar criação/login de cliente e prestador, busca pública, pedidos,
   aceite/recusa, avaliações, painel admin e alertas Web Push.
3. Desabilitar Data API em manutenção controlada; repetir testes.
4. Confirmar que Data API responde como desabilitada, enquanto rotas
   Fastify e Prisma permanecem operacionais.
5. Revisar grants e ACLs padrão em janela separada, com backup e plano
   de reversão dos privilégios específicos que eram necessários.
6. Corrigir S3–S7 em Pull Requests pequenas, com testes unitários e de
   integração; evitar mudanças simultâneas na autenticação e no banco.
7. Se houver regressão, reativar Data API temporariamente **somente
   após avaliar exposição**, ou restaurar grants estritamente necessários.

## Referências

- Supabase: https://supabase.com/docs/guides/api/securing-your-api
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Advisor: https://supabase.com/docs/guides/database/database-linter
