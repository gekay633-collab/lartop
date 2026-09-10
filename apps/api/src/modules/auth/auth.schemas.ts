import { z } from 'zod';

export const registrarClienteSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email(),
  senha: z.string().min(8).max(72),
  telefone: z.string().min(10).max(15).optional(),
});

export const registrarProfissionalSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email(),
  senha: z.string().min(8).max(72),
  telefone: z.string().min(10).max(15),
  cepBase: z.string().length(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export const solicitarRecuperacaoSchema = z.object({
  email: z.string().email(),
});

export const redefinirSenhaSchema = z.object({
  usuarioId: z.string().uuid(),
  token: z.string().min(10),
  novaSenha: z.string().min(8).max(72),
});

export type RegistrarClienteInput = z.infer<typeof registrarClienteSchema>;
export type RegistrarProfissionalInput = z.infer<typeof registrarProfissionalSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SolicitarRecuperacaoInput = z.infer<typeof solicitarRecuperacaoSchema>;
export type RedefinirSenhaInput = z.infer<typeof redefinirSenhaSchema>;
