import { z } from 'zod';

const urlImagemSegura = z.string().url().max(2048).refine((valor) => {
  const url = new URL(valor);
  return url.protocol === 'https:' && !url.username && !url.password;
}, { message: 'Use um endereço HTTPS válido para a imagem' });

export const criarSolicitacaoSchema = z.object({
  profissionalId: z.string().uuid(),
  categoriaId: z.string().uuid(),
  cep: z.string().length(8),
  endereco: z.string().min(5).max(300),
  tamanhoM2: z.number().min(1).max(100000),
  descricao: z.string().max(1000).optional(),
  fotos: z.array(urlImagemSegura).max(6).default([]),
});

export const atualizarStatusSchema = z.object({
  status: z.enum(['RESPONDIDA', 'ACEITA', 'RECUSADA', 'CONCLUIDA', 'CANCELADA']),
});

export const listarSolicitacoesQuerySchema = z.object({
  status: z.enum(['PENDENTE', 'RESPONDIDA', 'ACEITA', 'RECUSADA', 'CONCLUIDA', 'CANCELADA']).optional(),
  // Agrupamento exclusivo da lista do prestador, mantendo o status legado.
  grupo: z.enum(['NOVOS', 'EM_ANDAMENTO', 'HISTORICO']).optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(50).default(20),
}).refine(query => !query.grupo || !query.status, {
  message: 'Informe apenas status ou grupo, não ambos',
});

export type CriarSolicitacaoInput = z.infer<typeof criarSolicitacaoSchema>;
export type AtualizarStatusInput = z.infer<typeof atualizarStatusSchema>;
export type ListarSolicitacoesQuery = z.infer<typeof listarSolicitacoesQuerySchema>;
