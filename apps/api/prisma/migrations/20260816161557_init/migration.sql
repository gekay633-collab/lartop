-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('CLIENTE', 'PROFISSIONAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "PlanoProfissional" AS ENUM ('GRATUITO', 'PAGO');

-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('PENDENTE', 'RESPONDIDA', 'ACEITA', 'RECUSADA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoAvaliacao" AS ENUM ('CLIENTE_AVALIA_PROFISSIONAL', 'PROFISSIONAL_AVALIA_CLIENTE');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "tipo" "TipoUsuario" NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "telefone_verificado" BOOLEAN NOT NULL DEFAULT false,
    "email_verificado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "revogado" BOOLEAN NOT NULL DEFAULT false,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cidades" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "cidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ceps" (
    "cep" TEXT NOT NULL,
    "cidade_id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ceps_pkey" PRIMARY KEY ("cep")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfis_profissionais" (
    "usuario_id" TEXT NOT NULL,
    "nome_exibicao" TEXT NOT NULL,
    "bio" TEXT,
    "foto_perfil_url" TEXT,
    "cep_base" TEXT NOT NULL,
    "cidade_id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "raio_atendimento_km" INTEGER NOT NULL DEFAULT 15,
    "selo_verificado" BOOLEAN NOT NULL DEFAULT false,
    "nota_media" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_avaliacoes" INTEGER NOT NULL DEFAULT 0,
    "plano" "PlanoProfissional" NOT NULL DEFAULT 'GRATUITO',
    "perfil_publicado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfis_profissionais_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateTable
CREATE TABLE "profissional_categorias" (
    "id" TEXT NOT NULL,
    "profissional_id" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "valor_referencia" DOUBLE PRECISION,

    CONSTRAINT "profissional_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_portfolio" (
    "id" TEXT NOT NULL,
    "profissional_id" TEXT NOT NULL,
    "url_antes" TEXT,
    "url_depois" TEXT NOT NULL,
    "descricao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes_orcamento" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "profissional_id" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "descricao" TEXT,
    "fotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'PENDENTE',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitacoes_orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" TEXT NOT NULL,
    "solicitacao_id" TEXT NOT NULL,
    "avaliador_id" TEXT NOT NULL,
    "avaliado_id" TEXT NOT NULL,
    "tipo" "TipoAvaliacao" NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_usuario_id_idx" ON "refresh_tokens"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "cidades_slug_key" ON "cidades"("slug");

-- CreateIndex
CREATE INDEX "cidades_estado_idx" ON "cidades"("estado");

-- CreateIndex
CREATE INDEX "ceps_cidade_id_idx" ON "ceps"("cidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_slug_key" ON "categorias"("slug");

-- CreateIndex
CREATE INDEX "perfis_profissionais_cidade_id_idx" ON "perfis_profissionais"("cidade_id");

-- CreateIndex
CREATE INDEX "perfis_profissionais_lat_lng_idx" ON "perfis_profissionais"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "profissional_categorias_profissional_id_categoria_id_key" ON "profissional_categorias"("profissional_id", "categoria_id");

-- CreateIndex
CREATE INDEX "fotos_portfolio_profissional_id_idx" ON "fotos_portfolio"("profissional_id");

-- CreateIndex
CREATE INDEX "solicitacoes_orcamento_cliente_id_idx" ON "solicitacoes_orcamento"("cliente_id");

-- CreateIndex
CREATE INDEX "solicitacoes_orcamento_profissional_id_idx" ON "solicitacoes_orcamento"("profissional_id");

-- CreateIndex
CREATE INDEX "solicitacoes_orcamento_status_idx" ON "solicitacoes_orcamento"("status");

-- CreateIndex
CREATE INDEX "avaliacoes_avaliado_id_idx" ON "avaliacoes"("avaliado_id");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_solicitacao_id_avaliador_id_key" ON "avaliacoes"("solicitacao_id", "avaliador_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ceps" ADD CONSTRAINT "ceps_cidade_id_fkey" FOREIGN KEY ("cidade_id") REFERENCES "cidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfis_profissionais" ADD CONSTRAINT "perfis_profissionais_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfis_profissionais" ADD CONSTRAINT "perfis_profissionais_cidade_id_fkey" FOREIGN KEY ("cidade_id") REFERENCES "cidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissional_categorias" ADD CONSTRAINT "profissional_categorias_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "perfis_profissionais"("usuario_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissional_categorias" ADD CONSTRAINT "profissional_categorias_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_portfolio" ADD CONSTRAINT "fotos_portfolio_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "perfis_profissionais"("usuario_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_orcamento" ADD CONSTRAINT "solicitacoes_orcamento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_orcamento" ADD CONSTRAINT "solicitacoes_orcamento_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "perfis_profissionais"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_orcamento" ADD CONSTRAINT "solicitacoes_orcamento_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes_orcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_avaliador_id_fkey" FOREIGN KEY ("avaliador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_avaliado_id_fkey" FOREIGN KEY ("avaliado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
