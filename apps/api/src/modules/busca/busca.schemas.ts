import { z } from 'zod';

export const buscarProfissionaisSchema = z.object({
  cep: z.string().length(8, 'CEP deve ter 8 digitos'),
  categoria: z.string().optional(),
  raioKm: z.coerce.number().min(1).max(200).default(30),
  pagina: z.coerce.number().min(1).default(1),
  porPagina: z.coerce.number().min(1).max(50).default(20),
});

export type BuscarProfissionaisInput = z.infer<typeof buscarProfissionaisSchema>;
