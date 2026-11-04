import { z } from 'zod';

export const buscarProfissionaisSchema = z.object({
  cep: z.string().length(8, 'CEP deve ter 8 digitos'),
  categoria: z.string().optional(),
  raioKm: z.coerce.number().min(1).max(200).default(30),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(50).default(20),
});

export const buscarProfissionaisPorCidadeSchema = z.object({
  categoria: z.string().min(1).max(100).optional(),
  raioKm: z.coerce.number().min(1).max(200).default(15),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(50).default(20),
});

export const cidadeParamsSchema = z.object({
  estado: z.string().regex(/^[a-zA-Z]{2}$/),
  cidadeSlug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
});

export type BuscarProfissionaisInput = z.infer<typeof buscarProfissionaisSchema>;
