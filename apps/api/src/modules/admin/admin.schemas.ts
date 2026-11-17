import { z } from 'zod';

export const listarPrestadoresQuerySchema = z.object({
  busca: z.string().trim().max(120).optional(),
  status: z.enum(['publicado', 'nao_publicado']).optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

// Período explícito; a listagem é paginada para não carregar a base inteira.
export const listarResultadosPrestadoresQuerySchema = z.object({
  busca: z.string().trim().max(120).optional(),
  periodo: z.enum(['30d', 'todos']).default('30d'),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

export const listarClientesQuerySchema = z.object({
  busca: z.string().trim().max(120).optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

export const alternarBloqueioSchema = z.object({
  ativo: z.boolean(),
});

export const criarCategoriaSchema = z.object({
  nome: z.string().min(2).max(80),
  slug: z.string().min(2).max(80),
});

export const atualizarCategoriaSchema = z.object({
  nome: z.string().min(2).max(80).optional(),
  ativo: z.boolean().optional(),
});

export type ListarPrestadoresQuery = z.infer<typeof listarPrestadoresQuerySchema>;
export type ListarResultadosPrestadoresQuery = z.infer<typeof listarResultadosPrestadoresQuerySchema>;
export type ListarClientesQuery = z.infer<typeof listarClientesQuerySchema>;
export type AlternarBloqueioInput = z.infer<typeof alternarBloqueioSchema>;
export type CriarCategoriaInput = z.infer<typeof criarCategoriaSchema>;
export type AtualizarCategoriaInput = z.infer<typeof atualizarCategoriaSchema>;
