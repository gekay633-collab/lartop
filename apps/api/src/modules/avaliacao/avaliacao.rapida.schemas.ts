import { z } from 'zod';
import { tokenAcompanhamentoSchema } from '../solicitacao/solicitacao.rapida.schemas.js';

export const avaliarSolicitacaoRapidaSchema = z.object({
  token: tokenAcompanhamentoSchema,
  confirmacao: z.literal(true),
  nota: z.number().int().min(1).max(5),
  comentario: z.string().trim().max(500).optional(),
  publicarPrimeiroNome: z.boolean().default(false),
}).strict();

export type AvaliarSolicitacaoRapidaInput = z.infer<typeof avaliarSolicitacaoRapidaSchema>;

export const alterarNomePublicoSchema = z.object({
  token: tokenAcompanhamentoSchema,
  publicarPrimeiroNome: z.boolean(),
}).strict();
export type AlterarNomePublicoInput = z.infer<typeof alterarNomePublicoSchema>;
