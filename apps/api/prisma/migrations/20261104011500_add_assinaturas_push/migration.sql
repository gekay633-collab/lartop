-- Assinaturas Web Push por dispositivo. A API Lartop (Prisma) gerencia o acesso.
CREATE TABLE "assinaturas_push" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "endpoint" VARCHAR(1500) NOT NULL,
  "chave_p256dh" TEXT NOT NULL,
  "chave_auth" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assinaturas_push_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "assinaturas_push_endpoint_key" ON "assinaturas_push"("endpoint");
CREATE INDEX "assinaturas_push_usuario_id_idx" ON "assinaturas_push"("usuario_id");
ALTER TABLE "assinaturas_push"
  ADD CONSTRAINT "assinaturas_push_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Nunca disponibilizar endpoints e chaves de dispositivos via Supabase Data API.
ALTER TABLE "public"."assinaturas_push" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "public"."assinaturas_push" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE "public"."assinaturas_push" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE "public"."assinaturas_push" FROM authenticated;
  END IF;
END
$$;
