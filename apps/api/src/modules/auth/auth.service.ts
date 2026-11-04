import { randomUUID, createHash } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { gerarHashSenha, verificarSenha } from '../../lib/senha.js';
import { gerarAccessToken, gerarRefreshToken, verificarAccessToken, verificarRefreshToken } from '../../lib/jwt.js';
import { redis } from '../../lib/redis.js';
import { resolverCep, CepInvalidoError } from '../../lib/cep.js';

const REFRESH_TOKEN_TTL_SEGUNDOS = 60 * 60 * 24 * 30;

class AuthError extends Error {}

export async function registrarCliente(input: {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
}) {
  const existente = await prisma.usuario.findUnique({ where: { email: input.email } });
  if (existente) {
    throw new AuthError('E-mail já cadastrado');
  }

  const senhaHash = await gerarHashSenha(input.senha);

  const usuario = await prisma.usuario.create({
    data: {
      nome: input.nome,
      email: input.email,
      senhaHash,
      telefone: input.telefone,
      tipo: 'CLIENTE',
    },
  });

  return usuario;
}

export async function registrarProfissional(input: {
  nome: string;
  email: string;
  senha: string;
  telefone: string;
  cepBase: string;
}) {
  const existente = await prisma.usuario.findUnique({ where: { email: input.email } });
  if (existente) {
    throw new AuthError('E-mail já cadastrado');
  }

  let cep;
  try {
    cep = await resolverCep(input.cepBase);
  } catch (err) {
    if (err instanceof CepInvalidoError) {
      throw new AuthError(err.message);
    }
    throw err;
  }

  const senhaHash = await gerarHashSenha(input.senha);

  const usuario = await prisma.$transaction(async (tx: any) => {
    const novoUsuario = await tx.usuario.create({
      data: {
        nome: input.nome,
        email: input.email,
        senhaHash,
        telefone: input.telefone,
        tipo: 'PROFISSIONAL',
      },
    });

    await tx.perfilProfissional.create({
      data: {
        usuarioId: novoUsuario.id,
        nomeExibicao: input.nome,
        cepBase: input.cepBase.replace(/\D/g, ''),
        cidadeId: cep.cidadeId,
        lat: cep.lat,
        lng: cep.lng,
      },
    });

    return novoUsuario;
  });

  return usuario;
}

export async function autenticar(email: string, senha: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.ativo) {
    throw new AuthError('Credenciais inválidas');
  }

  const senhaValida = await verificarSenha(usuario.senhaHash, senha);
  if (!senhaValida) {
    throw new AuthError('Credenciais inválidas');
  }

  return emitirTokens(usuario.id, usuario.tipo);
}

export async function emitirTokens(usuarioId: string, tipo: 'CLIENTE' | 'PROFISSIONAL' | 'ADMIN') {
  const accessToken = gerarAccessToken({ sub: usuarioId, tipo });
  const jti = randomUUID();
  const refreshToken = gerarRefreshToken({ sub: usuarioId, jti });

  await redis.set(
    `refresh:${jti}:${usuarioId}`,
    refreshToken,
    'EX',
    REFRESH_TOKEN_TTL_SEGUNDOS
  );

  return { accessToken, refreshToken, jti };
}

export async function renovarTokens(refreshToken: string) {
  let payload: { sub: string; jti: string };
  try {
    payload = verificarRefreshToken(refreshToken);
  } catch {
    throw new AuthError('Token de renovação inválido');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: payload.sub } });
  if (!usuario || !usuario.ativo) {
    throw new AuthError('Usuário inválido');
  }

  // Consome a sessão de forma atômica: tokens revogados ou reutilizados não renovam acesso.
  const chaveSessao = `refresh:${payload.jti}:${payload.sub}`;
  const tokenRegistrado = await redis.getdel(chaveSessao);
  if (tokenRegistrado !== refreshToken) {
    throw new AuthError('Sessão expirada ou revogada');
  }

  return emitirTokens(usuario.id, usuario.tipo);
}

function chaveAccessRevogado(token: string): string {
  return `auth:access:revogado:${createHash('sha256').update(token).digest('hex')}`;
}

export async function tokenDeAcessoRevogado(token: string): Promise<boolean> {
  return (await redis.exists(chaveAccessRevogado(token))) === 1;
}

export async function revogarTokenDeAcesso(token: string): Promise<void> {
  let expiraEm: number | undefined;
  try {
    const payload = verificarAccessToken(token) as { exp?: number };
    expiraEm = payload.exp;
  } catch {
    return;
  }
  if (typeof expiraEm !== 'number') return;
  const segundosRestantes = Math.ceil(expiraEm - Date.now() / 1000);
  if (segundosRestantes > 0) {
    await redis.set(chaveAccessRevogado(token), '1', 'EX', segundosRestantes);
  }
}

// Logout encerra apenas o dispositivo atual; bloqueio e troca de senha revogam todas as sessões.
export async function revogarTokenRefresh(token: string): Promise<void> {
  let payload: { sub: string; jti: string };
  try {
    payload = verificarRefreshToken(token);
  } catch {
    // Um cookie ausente/inválido não deve causar revogação de outras contas.
    return;
  }
  await redis.del(`refresh:${payload.jti}:${payload.sub}`);
}

export async function revogarSessao(usuarioId: string) {
  const chaves = await redis.keys(`refresh:*:${usuarioId}`);
  if (chaves.length > 0) {
    await redis.del(...chaves);
  }
}

export { AuthError };

export async function solicitarRecuperacaoSenha(email: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  // Nao revela se o e-mail existe ou nao (evita enumeracao de contas)
  if (!usuario || !usuario.ativo) {
    return;
  }

  const tokenBruto = randomUUID() + randomUUID();
  const tokenHash = await gerarHashSenha(tokenBruto);

  const expiraEm = new Date();
  expiraEm.setHours(expiraEm.getHours() + 1);

  await prisma.tokenRecuperacaoSenha.create({
    data: { usuarioId: usuario.id, tokenHash, expiraEm },
  });

  const link = `${process.env.FRONTEND_URL}/redefinir-senha?token=${tokenBruto}&id=${usuario.id}`;

  const { enviarEmailRecuperacaoSenha } = await import('../../lib/email.js');
  await enviarEmailRecuperacaoSenha(usuario.email, usuario.nome, link);
}

export async function redefinirSenha(usuarioId: string, tokenBruto: string, novaSenha: string) {
  const tokens = await prisma.tokenRecuperacaoSenha.findMany({
    where: { usuarioId, usado: false, expiraEm: { gte: new Date() } },
    orderBy: { criadoEm: 'desc' },
  });

  let tokenValido = null;
  for (const token of tokens) {
    const bate = await verificarSenha(token.tokenHash, tokenBruto);
    if (bate) {
      tokenValido = token;
      break;
    }
  }

  if (!tokenValido) {
    throw new AuthError('Link inválido ou expirado');
  }

  const novaSenhaHash = await gerarHashSenha(novaSenha);

  await prisma.$transaction(async (tx) => {
    // Consumo condicionado: duas requisições concorrentes não podem usar o mesmo link.
    const consumido = await tx.tokenRecuperacaoSenha.updateMany({
      where: { id: tokenValido.id, usuarioId, usado: false, expiraEm: { gt: new Date() } },
      data: { usado: true },
    });
    if (consumido.count !== 1) {
      throw new AuthError('Link inválido, já utilizado ou expirado');
    }
    await tx.usuario.update({ where: { id: usuarioId }, data: { senhaHash: novaSenhaHash } });
  });
  // Não permite que sessões antigas continuem sendo renovadas após a troca da senha.
  await revogarSessao(usuarioId);
}
