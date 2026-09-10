import { z } from 'zod';

export const criarSolicitacaoSchema = z.object({
  profissionalId: z.string().uuid(),
  categoriaId: z.string().uuid(),
  cep: z.string().length(8),
  endereco: z.string().min(5).max(300),
  tamanhoM2: z.number().min(1).max(100000),
  descricao: z.string().max(1000).optional(),
  fotos: z.array(z.string().url()).max(6).default([]),
});

export const atualizarStatusSchema = z.object({
  status: z.enum(['RESPONDIDA', 'ACEITA', 'RECUSADA', 'CONCLUIDA', 'CANCELADA']),
});

export const listarSolicitacoesQuerySchema = z.object({
  status: z.enum(['PENDENTE', 'RESPONDIDA', 'ACEITA', 'RECUSADA', 'CONCLUIDA', 'CANCELADA']).optional(),
  pagina: z.coerce.number().min(1).default(1),
  porPagina: z.coerce.number().min(1).max(50).default(20),
});

export type CriarSolicitacaoInput = z.infer<typeof criarSolicitacaoSchema>;
export type AtualizarStatusInput = z.infer<typeof atualizarStatusSchema>;
export type ListarSolicitacoesQuery = z.infer<typeof listarSolicitacoesQuerySchema>;
