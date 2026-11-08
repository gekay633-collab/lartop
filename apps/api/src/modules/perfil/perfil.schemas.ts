import { imagemDaContaLartop } from '../../lib/imagem-segura.js';
import { z } from 'zod';

const urlImagemSegura = z.string().url().max(2048).refine(imagemDaContaLartop, {
  message: 'Utilize uma imagem enviada pelo Lartop',
});

export const atualizarPerfilSchema = z.object({
  nomeExibicao: z.string().min(2).max(120).optional(),
  bio: z.string().max(1000).optional(),
  fotoPerfilUrl: urlImagemSegura.optional(),
  raioAtendimentoKm: z.number().min(1).max(100).optional(),
});

// O prestador pode alterar o número usado nos links do WhatsApp.
// Aceita 11 dígitos com DDD, com ou sem prefixo internacional +55.
export const atualizarTelefoneSchema = z.object({
  telefone: z.string().trim().min(10).max(25)
    .transform((valor) => valor.replace(/\D/g, ''))
    .transform((digitos) => digitos.length === 13 && digitos.startsWith('55')
      ? digitos.slice(2) : digitos)
    .refine((digitos) => /^[1-9]{2}9\d{8}$/.test(digitos), {
      message: 'Informe um celular com DDD, usando 11 dígitos.',
    }),
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
    .refine((itens) => new Set(itens.map((item) => item.categoriaId)).size === itens.length, {
      message: 'Nao selecione servicos repetidos',
    }),
});

export const adicionarFotoPortfolioSchema = z.object({
  urlAntes: urlImagemSegura.optional(),
  urlDepois: urlImagemSegura,
  descricao: z.string().max(300).optional(),
});

export type AtualizarPerfilInput = z.infer<typeof atualizarPerfilSchema>;
export type AtualizarTelefoneInput = z.infer<typeof atualizarTelefoneSchema>;
export type DefinirCategoriasInput = z.infer<typeof definirCategoriasSchema>;
export type AdicionarFotoPortfolioInput = z.infer<typeof adicionarFotoPortfolioSchema>;
