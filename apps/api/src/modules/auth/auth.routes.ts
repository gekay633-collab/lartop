import type { FastifyInstance } from 'fastify';
import {
  registrarClienteSchema,
  registrarProfissionalSchema,
  loginSchema,
  solicitarRecuperacaoSchema,
  redefinirSenhaSchema,
} from './auth.schemas.js';
import {
  registrarCliente,
  registrarProfissional,
  autenticar,
  renovarTokens,
  revogarSessao,
  emitirTokens,
  solicitarRecuperacaoSenha,
  redefinirSenha,
  AuthError,
} from './auth.service.js';
import { verificarAccessToken } from '../../lib/jwt.js';
import { limiteAutenticacao } from '../../plugins/seguranca.js';

const COOKIE_REFRESH_NOME = 'lartop_refresh';

function definirCookieRefresh(reply: any, refreshToken: string) {
  reply.setCookie(COOKIE_REFRESH_NOME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/registrar/cliente', limiteAutenticacao, async (request, reply) => {
    const parse = registrarClienteSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos', detalhes: parse.error.flatten() });
    }

    try {
      const usuario = await registrarCliente(parse.data);
      const { accessToken, refreshToken } = await emitirTokens(usuario.id, 'CLIENTE');
      definirCookieRefresh(reply, refreshToken);
      return reply.status(201).send({
        usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo },
        accessToken,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(409).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao registrar cliente' });
    }
  });

  app.post('/auth/registrar/profissional', limiteAutenticacao, async (request, reply) => {
    const parse = registrarProfissionalSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos', detalhes: parse.error.flatten() });
    }

    try {
      const usuario = await registrarProfissional(parse.data);
      const { accessToken, refreshToken } = await emitirTokens(usuario.id, 'PROFISSIONAL');
      definirCookieRefresh(reply, refreshToken);
      return reply.status(201).send({
        usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo },
        accessToken,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(409).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao registrar profissional' });
    }
  });

  app.post('/auth/login', limiteAutenticacao, async (request, reply) => {
    const parse = loginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos' });
    }

    try {
      const { accessToken, refreshToken } = await autenticar(parse.data.email, parse.data.senha);
      definirCookieRefresh(reply, refreshToken);
      return reply.send({ accessToken });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(401).send({ erro: 'E-mail ou senha invalidos' });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao autenticar' });
    }
  });

  app.post('/auth/refresh', async (request, reply) => {
    const token = request.cookies[COOKIE_REFRESH_NOME];
    if (!token) {
      return reply.status(401).send({ erro: 'Refresh token ausente' });
    }

    try {
      const { accessToken, refreshToken } = await renovarTokens(token);
      definirCookieRefresh(reply, refreshToken);
      return reply.send({ accessToken });
    } catch (err) {
      return reply.status(401).send({ erro: 'Sessao invalida, faca login novamente' });
    }
  });

  app.post('/auth/logout', async (request, reply) => {
    const auth = request.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = verificarAccessToken(auth.slice(7));
        await revogarSessao(payload.sub);
      } catch {
        // token ja invalido, segue o logout mesmo assim
      }
    }
    reply.clearCookie(COOKIE_REFRESH_NOME, { path: '/' });
    return reply.send({ ok: true });
  });

  app.post('/auth/esqueci-senha', limiteAutenticacao, async (request, reply) => {
    const parse = solicitarRecuperacaoSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos' });
    }

    try {
      await solicitarRecuperacaoSenha(parse.data.email);
    } catch (err) {
      request.log.error(err);
    }

    return reply.send({ ok: true, mensagem: 'Se o e-mail existir, enviamos um link de recuperacao.' });
  });

  app.post('/auth/redefinir-senha', limiteAutenticacao, async (request, reply) => {
    const parse = redefinirSenhaSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos' });
    }

    try {
      await redefinirSenha(parse.data.usuarioId, parse.data.token, parse.data.novaSenha);
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(400).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao redefinir senha' });
    }
  });
}
