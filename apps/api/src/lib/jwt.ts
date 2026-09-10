import jwt from 'jsonwebtoken';

interface PayloadAccessToken {
  sub: string;
  tipo: 'CLIENTE' | 'PROFISSIONAL' | 'ADMIN';
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT secrets nao configurados no .env');
}

export function gerarAccessToken(payload: PayloadAccessToken): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

export function gerarRefreshToken(payload: { sub: string }): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verificarAccessToken(token: string): PayloadAccessToken {
  return jwt.verify(token, ACCESS_SECRET) as PayloadAccessToken;
}

export function verificarRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}
