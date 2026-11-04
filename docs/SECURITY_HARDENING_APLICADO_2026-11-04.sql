-- HISTÓRICO DE SEGURANÇA JÁ EXECUTADO NO SUPABASE DO LARTOP
-- 04/11/2026 | NÃO é uma migration pendente, NÃO executar por engano.
-- Todos os comandos de proteção já foram aplicados e verificados.
--
-- Primeira transação: remover concessões diretas às roles da Data API.
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
COMMIT;

-- Segunda transação: RLS como defesa em profundidade.
BEGIN;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens_recuperacao_senha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_orcamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profissional_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_analytics ENABLE ROW LEVEL SECURITY;
COMMIT;

-- Terceira transação: proteger objetos futuros criados por postgres.
BEGIN;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
COMMIT;

-- Consulta somente leitura: deve retornar 14, 14 e zero.
SELECT
 COUNT(*) AS total,
 COUNT(*) FILTER (WHERE c.relrowsecurity) AS rls_ativo,
 COUNT(*) FILTER (WHERE
   has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
   OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
 ) AS tabelas_expostas
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relkind='r';

-- Plano de reversão, APENAS se o backend apresentar regressão:
-- 1. Identificar a role usada pela API e os recursos afetados.
-- 2. Conceder SOMENTE o acesso necessário à role de backend confiável,
--    preservando as proibições de anon/authenticated.
-- 3. Se houver incompatibilidade estritamente causada pelo RLS,
--    reverter RLS apenas nas tabelas envolvidas e manter os REVOKE.
-- NUNCA reativar GRANT ALL para anon/authenticated como solução.
--
-- Pendente fora desta execução: privilégios padrão da role supabase_admin
-- e mudança em Data API > Automatically expose new tables.
