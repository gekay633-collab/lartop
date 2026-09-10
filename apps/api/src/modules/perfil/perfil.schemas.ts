import { z } from 'zod';

export const atualizarPerfilSchema = z.object({
  nomeExibicao: z.string().min(2).max(120).optional(),
  bio: z.string().max(1000).optional(),
  fotoPerfilUrl: z.string().url().optional(),
  raioAtendimentoKm: z.number().min(1).max(100).optional(),
});

export const definirCategoriasSchema = z.object({
  categorias: z
    .array(
      z.object({
        categoriaId: z.string().uuid(),
        valorReferencia: z.number().min(0).optional(),
      })
    )
    .min(1)
    .max(6),
});

export const adicionarFotoPortfolioSchema = z.object({
  urlAntes: z.string().url().optional(),
  urlDepois: z.string().url(),
  descricao: z.string().max(300).optional(),
});

export type AtualizarPerfilInput = z.infer<typeof atualizarPerfilSchema>;
export type DefinirCategoriasInput = z.infer<typeof definirCategoriasSchema>;
export type AdicionarFotoPortfolioInput = z.infer<typeof adicionarFotoPortfolioSchema>;
