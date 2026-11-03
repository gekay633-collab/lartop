import { createHash } from 'node:crypto';
import { redis } from '../../lib/redis.js';

const MAX_TENTATIVAS = 5;
const JANELA_SEGUNDOS = 15 * 60;

// Chaves anônimas: e-mails não ficam expostos nos nomes das chaves do Redis.
function chaveFalhasLogin(email: string): string {
  const identificador = createHash('sha256')
    .update(email.trim().toLowerCase())
    .digest('hex');
  return `auth:login:falhas:${identificador}`;
}

export async function consultarBloqueioLogin(email: string): Promise<number | null> {
  const chave = chaveFalhasLogin(email);
  const falhas = Number(await redis.get(chave));
  if (!Number.isFinite(falhas) || falhas < MAX_TENTATIVAS) return null;

  const ttl = Number(await redis.ttl(chave));
  // A chave expirada libera o acesso naturalmente.
  return ttl > 0 ? ttl : null;
}

// INCR + EXPIRE atômicos: a primeira falha abre a janela de 15 minutos.
// Tentativas subsequentes não prolongam a janela e não geram bloqueio permanente.
const SCRIPT_CONTAR_FALHA = `
  local tentativas = redis.call('INCR', KEYS[1])
  if tentativas == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
  end
  return {tentativas, redis.call('TTL', KEYS[1])}
`;

export async function registrarFalhaLogin(email: string): Promise<{
  bloqueado: boolean;
  restantes: number;
  aguardarSegundos: number;
}> {
  const [contagemBruta, ttlBruto] = (await redis.eval(
    SCRIPT_CONTAR_FALHA,
    1,
    chaveFalhasLogin(email),
    String(JANELA_SEGUNDOS),
  )) as [number, number];

  const contagem = Number(contagemBruta);
  const ttl = Number(ttlBruto);
  return {
    bloqueado: contagem >= MAX_TENTATIVAS,
    restantes: Math.max(0, MAX_TENTATIVAS - contagem),
    aguardarSegundos: Math.max(1, ttl),
  };
}

export async function limparFalhasLogin(email: string): Promise<void> {
  await redis.del(chaveFalhasLogin(email));
}
