-- Backwards-compatible with existing requests: old PWA clients omit the key.
-- New requests use SHA-256(clienteId + UUID) as the unique key.
ALTER TABLE "solicitacoes_orcamento"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "idempotency_hash" TEXT;

CREATE UNIQUE INDEX "solicitacoes_orcamento_idempotency_key_key"
  ON "solicitacoes_orcamento"("idempotency_key");
