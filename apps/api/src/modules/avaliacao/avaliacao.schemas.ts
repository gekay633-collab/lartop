import { z } from 'zod';

export const criarAvaliacaoSchema = z.object({
  solicitacaoId: z.string().uuid(),
  nota: z.number().int().min(1).max(5),
  comentario: z.string().max(500).optional(),
});

export type CriarAvaliacaoInput = z.infer<typeof criarAvaliacaoSchema>;
