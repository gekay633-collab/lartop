-- Migração aditiva; preserva avaliações e prestadores existentes.
-- NULL = anonimato. Não publicar nomes dos registros antigos automaticamente.
ALTER TABLE "public"."avaliacoes_visitantes" ADD COLUMN "nome_publico" TEXT;
