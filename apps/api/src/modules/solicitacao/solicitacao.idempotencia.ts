import { createHash } from 'node:crypto';
import type { CriarSolicitacaoInput } from './solicitacao.schemas.js';

/** Nunca persistir a chave enviada pelo navegador ou um identificador de conta puro. */
export function chaveDePedido(clienteId: string, chave: string): string {
  return createHash('sha256').update(JSON.stringify([clienteId, chave])).digest('hex');
}

/** Campos canônicos após validação Zod: a mesma tentativa deve ter o mesmo conteúdo. */
export function hashDePedido(input: CriarSolicitacaoInput): string {
  return createHash('sha256').update(JSON.stringify({
    profissionalId: input.profissionalId,
    categoriaId: input.categoriaId,
    cep: input.cep,
    endereco: input.endereco,
    tamanhoM2: input.tamanhoM2,
    descricao: input.descricao ?? null,
    fotos: input.fotos,
  })).digest('hex');
}
