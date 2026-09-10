-- CreateTable
CREATE TABLE "tokens_recuperacao_senha" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacao_senha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tokens_recuperacao_senha_usuario_id_idx" ON "tokens_recuperacao_senha"("usuario_id");
