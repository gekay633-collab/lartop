-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('PESQUISA', 'VISUALIZACAO_PERFIL', 'CONTATO_GERADO');

-- CreateTable
CREATE TABLE "eventos_analytics" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "cidade_id" TEXT,
    "categoria_id" TEXT,
    "profissional_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_analytics_tipo_cidade_id_categoria_id_idx" ON "eventos_analytics"("tipo", "cidade_id", "categoria_id");

-- CreateIndex
CREATE INDEX "eventos_analytics_criado_em_idx" ON "eventos_analytics"("criado_em");
