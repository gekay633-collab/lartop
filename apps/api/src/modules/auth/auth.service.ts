import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { gerarHashSenha, verificarSenha } from '../../lib/senha.js';
import { gerarAccessToken, gerarRefreshToken, verificarRefreshToken } from '../../lib/jwt.js';
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
    throw new AuthError('E-mail ja cadastrado');
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
    throw new AuthError('E-mail ja cadastrado');
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

  const usuario = await prisma.$transaction(async (tx) => {
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
    throw new AuthError('Credenciais invalidas');
  }

  const senhaValida = await verificarSenha(usuario.senhaHash, senha);
  if (!senhaValida) {
    throw new AuthError('Credenciais invalidas');
  }

  return emitirTokens(usuario.id, usuario.tipo);
}

export async function emitirTokens(usuarioId: string, tipo: 'CLIENTE' | 'PROFISSIONAL' | 'ADMIN') {
  const accessToken = gerarAccessToken({ sub: usuarioId, tipo });
  const refreshToken = gerarRefreshToken({ sub: usuarioId });
  const jti = randomUUID();

  await redis.set(
    `refresh:${jti}:${usuarioId}`,
    refreshToken,
    'EX',
    REFRESH_TOKEN_TTL_SEGUNDOS
  );

  return { accessToken, refreshToken, jti };
}

export async function renovarTokens(refreshToken: string) {
  let payload: { sub: string };
  try {
    payload = verificarRefreshToken(refreshToken);
  } catch {
    throw new AuthError('Refresh token invalido');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: payload.sub } });
  if (!usuario || !usuario.ativo) {
    throw new AuthError('Usuario invalido');
  }

  return emitirTokens(usuario.id, usuario.tipo);
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
    throw new AuthError('Link invalido ou expirado');
  }

  const novaSenhaHash = await gerarHashSenha(novaSenha);

  await prisma.$transaction([
    prisma.usuario.update({ where: { id: usuarioId }, data: { senhaHash: novaSenhaHash } }),
    prisma.tokenRecuperacaoSenha.update({ where: { id: tokenValido.id }, data: { usado: true } }),
  ]);
}
