-- AlterTable
ALTER TABLE "solicitacoes_orcamento" ADD COLUMN "tamanho_m2" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Remove o default: novas linhas passam a exigir o valor explicitamente
ALTER TABLE "solicitacoes_orcamento" ALTER COLUMN "tamanho_m2" DROP DEFAULT;
