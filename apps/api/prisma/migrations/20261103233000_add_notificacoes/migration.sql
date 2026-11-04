-- Adiciona apenas os registros de notificações; não altera solicitações existentes.
CREATE TYPE "TipoNotificacao" AS ENUM (
  'NOVA_SOLICITACAO',
  'SOLICITACAO_RESPONDIDA',
  'SOLICITACAO_ACEITA',
  'SOLICITACAO_RECUSADA',
  'SOLICITACAO_CONCLUIDA',
  'SOLICITACAO_CANCELADA'
);

CREATE TABLE "notificacoes" (
  "id" TEXT NOT NULL,
  "destinatario_id" TEXT NOT NULL,
  "solicitacao_id" TEXT,
  "tipo" "TipoNotificacao" NOT NULL,
  "titulo" TEXT NOT NULL,
  "mensagem" TEXT NOT NULL,
  "lida_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notificacoes_destinatario_id_solicitacao_id_tipo_key"
  ON "notificacoes"("destinatario_id", "solicitacao_id", "tipo");
CREATE INDEX "notificacoes_destinatario_id_lida_em_criado_em_idx"
  ON "notificacoes"("destinatario_id", "lida_em", "criado_em");

ALTER TABLE "notificacoes"
  ADD CONSTRAINT "notificacoes_destinatario_id_fkey"
  FOREIGN KEY ("destinatario_id") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notificacoes"
  ADD CONSTRAINT "notificacoes_solicitacao_id_fkey"
  FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes_orcamento"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Lartop usa autenticação própria e serve os dados pelo Fastify/Prisma.
-- A tabela de notificações não deve ficar exposta via Supabase Data API.
ALTER TABLE "public"."notificacoes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."notificacoes" FROM PUBLIC;

-- Em homologação a base local pode não possuir as roles especiais do Supabase.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE "public"."notificacoes" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE "public"."notificacoes" FROM authenticated;
  END IF;
END
$$;
