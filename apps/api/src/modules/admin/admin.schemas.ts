import { z } from 'zod';

export const listarPrestadoresQuerySchema = z.object({
  busca: z.string().optional(),
  status: z.enum(['publicado', 'nao_publicado']).optional(),
  pagina: z.coerce.number().min(1).default(1),
  porPagina: z.coerce.number().min(1).max(100).default(20),
});

export const listarClientesQuerySchema = z.object({
  busca: z.string().optional(),
  pagina: z.coerce.number().min(1).default(1),
  porPagina: z.coerce.number().min(1).max(100).default(20),
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
export type ListarClientesQuery = z.infer<typeof listarClientesQuerySchema>;
export type AlternarBloqueioInput = z.infer<typeof alternarBloqueioSchema>;
export type CriarCategoriaInput = z.infer<typeof criarCategoriaSchema>;
export type AtualizarCategoriaInput = z.infer<typeof atualizarCategoriaSchema>;
