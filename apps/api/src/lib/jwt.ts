import jwt from 'jsonwebtoken';
import { randomUUID, createHmac } from 'node:crypto';

interface PayloadAccessToken {
  sub: string;
  tipo: 'CLIENTE' | 'PROFISSIONAL' | 'ADMIN';
  credenciaisVersao: string;
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn'];
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as jwt.SignOptions['expiresIn'];

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT secrets nao configurados no .env');
}

// A versão não revela o hash de senha: ela é autenticada com um segredo do servidor.
export function versaoCredenciais(senhaHash: string): string {
  return createHmac('sha256', ACCESS_SECRET).update(senhaHash).digest('base64url');
}

export function gerarAccessToken(payload: PayloadAccessToken): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN, jwtid: randomUUID() });
}

export function gerarRefreshToken(payload: { sub: string; jti: string }): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verificarAccessToken(token: string): PayloadAccessToken {
  return jwt.verify(token, ACCESS_SECRET) as PayloadAccessToken;
}

export function verificarRefreshToken(token: string): { sub: string; jti: string } {
  const payload = jwt.verify(token, REFRESH_SECRET) as { sub?: unknown; jti?: unknown };
  if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string' || !payload.jti) {
    throw new Error('Refresh token sem identificador de sessão');
  }
  return { sub: payload.sub, jti: payload.jti };
}
