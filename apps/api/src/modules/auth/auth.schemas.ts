import { z } from 'zod';

const emailNormalizado = z.string().trim().email().max(254).transform(email => email.toLowerCase());

export const registrarClienteSchema = z.object({
  nome: z.string().min(2).max(120),
  email: emailNormalizado,
  senha: z.string().min(8).max(72),
  telefone: z.string().min(10).max(15).optional(),
});

export const registrarProfissionalSchema = z.object({
  nome: z.string().min(2).max(120),
  email: emailNormalizado,
  senha: z.string().min(8).max(72),
  telefone: z.string().min(10).max(15),
  cepBase: z.string().length(8),
});

export const loginSchema = z.object({
  email: emailNormalizado,
  senha: z.string().min(1).max(72),
});

export const solicitarRecuperacaoSchema = z.object({
  email: emailNormalizado,
});

export const redefinirSenhaSchema = z.object({
  usuarioId: z.string().uuid(),
  token: z.string().min(10).max(256),
  novaSenha: z.string().min(8).max(72),
});

export type RegistrarClienteInput = z.infer<typeof registrarClienteSchema>;
export type RegistrarProfissionalInput = z.infer<typeof registrarProfissionalSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SolicitarRecuperacaoInput = z.infer<typeof solicitarRecuperacaoSchema>;
export type RedefinirSenhaInput = z.infer<typeof redefinirSenhaSchema>;
