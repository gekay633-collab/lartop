-- Migração aditiva e não destrutiva: contas e solicitações antigas continuam vinculadas.
-- Campos opcionais só são preenchidos para novos pedidos de visitantes.
ALTER TABLE "solicitacoes_orcamento"
  ALTER COLUMN "cliente_id" DROP NOT NULL,
  ALTER COLUMN "cep" DROP NOT NULL,
  ALTER COLUMN "endereco" DROP NOT NULL,
  ALTER COLUMN "tamanho_m2" DROP NOT NULL,
  ADD COLUMN "cliente_nome_rapido" TEXT,
  ADD COLUMN "cliente_whatsapp_rapido" TEXT,
  ADD COLUMN "acesso_token_hash" TEXT,
  ADD COLUMN "acesso_expira_em" TIMESTAMP(3);
