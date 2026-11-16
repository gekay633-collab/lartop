-- Aditivo: não altera registros de usuários, perfis, fotos ou avaliações antigas.
CREATE SEQUENCE "public"."solicitacoes_referencia_curta_seq"
  AS INTEGER START WITH 10000 INCREMENT BY 1 MINVALUE 10000 MAXVALUE 99999 NO CYCLE;

ALTER TABLE "public"."solicitacoes_orcamento"
  ADD COLUMN "referencia_curta" INTEGER;

ALTER TABLE "public"."solicitacoes_orcamento"
  ALTER COLUMN "referencia_curta" SET DEFAULT nextval('public.solicitacoes_referencia_curta_seq'::regclass);

ALTER SEQUENCE "public"."solicitacoes_referencia_curta_seq"
  OWNED BY "public"."solicitacoes_orcamento"."referencia_curta";

CREATE UNIQUE INDEX "solicitacoes_orcamento_referencia_curta_key"
  ON "public"."solicitacoes_orcamento" ("referencia_curta");

CREATE TABLE "public"."avaliacoes_visitantes" (
  "id" TEXT PRIMARY KEY,
  "solicitacao_id" TEXT NOT NULL,
  "nota" INTEGER NOT NULL,
  "comentario" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "avaliacoes_visitantes_nota_check" CHECK ("nota" BETWEEN 1 AND 5),
  CONSTRAINT "avaliacoes_visitantes_solicitacao_fkey"
    FOREIGN KEY ("solicitacao_id") REFERENCES "public"."solicitacoes_orcamento"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "avaliacoes_visitantes_solicitacao_id_key" ON "public"."avaliacoes_visitantes" ("solicitacao_id");
ALTER TYPE "public"."TipoNotificacao" ADD VALUE IF NOT EXISTS 'NOVA_AVALIACAO';
