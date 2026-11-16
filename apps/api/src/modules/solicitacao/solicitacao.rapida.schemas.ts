import { z } from 'zod';

// Aceita apenas celular brasileiro com DDD e nono dígito, com ou sem +55.
// O número informado não é considerado verificado.
export const whatsappBrasileiro = z.string().trim().transform((valor) => {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length === 13 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
}).pipe(z.string().regex(/^[1-9][0-9]9[0-9]{8}$/, 'Informe um celular com DDD válido'));

export const tokenAcompanhamentoSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const criarSolicitacaoRapidaSchema = z.object({
  profissionalId: z.string().uuid(),
  categoriaId: z.string().uuid(),
  nome: z.string().trim().min(2).max(80),
  whatsapp: whatsappBrasileiro,
  descricao: z.string().trim().min(8).max(1000),
  tentativaId: z.string().uuid(),
  token: tokenAcompanhamentoSchema,
  consentimento: z.literal(true),
  // Campo invisível para robôs simples. O cliente real deixa vazio.
  site: z.string().max(0).optional(),
}).strict();

export const acompanharSolicitacaoRapidaSchema = z.object({
  token: tokenAcompanhamentoSchema,
}).strict();

export type CriarSolicitacaoRapidaInput = z.infer<typeof criarSolicitacaoRapidaSchema>;
