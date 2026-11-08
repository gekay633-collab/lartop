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
  revogarTokenRefresh,
  revogarTokenDeAcesso,
  emitirTokens,
  solicitarRecuperacaoSenha,
  redefinirSenha,
  AuthError,
} from './auth.service.js';
import { limiteAutenticacao } from '../../plugins/seguranca.js';
import {
  consultarBloqueioLogin,
  registrarFalhaLogin,
  limparFalhasLogin,
} from './limite-login.js';

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
  // Authentication responses must never be stored by browsers or intermediary caches.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('Pragma', 'no-cache');
    return payload;
  });

  // Cookie-authenticated endpoints must not accept cross-origin browser requests.
  // Missing Origin is allowed for native clients; browser cross-site requests send it.
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.split('?')[0].endsWith('/auth/refresh') &&
        !request.url.split('?')[0].endsWith('/auth/logout')) return;
    const origin = request.headers.origin;
    if (!origin) return;
    const configured = process.env.FRONTEND_URL?.trim() ||
      (process.env.NODE_ENV === 'production'
        ? 'https://lartop-ats6.vercel.app' : 'http://localhost:3000');
    let allowed: string;
    try { allowed = new URL(configured).origin; }
    catch { return reply.status(503).send({ erro: 'Origem oficial não configurada' }); }
    if (origin !== allowed) {
      return reply.status(403).send({ erro: 'Origem não autorizada' });
    }
  });
  app.post('/auth/registrar/cliente', limiteAutenticacao, async (request, reply) => {
    const parse = registrarClienteSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados inválidos', detalhes: parse.error.flatten() });
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
      return reply.status(400).send({ erro: 'Dados inválidos', detalhes: parse.error.flatten() });
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
      return reply.status(400).send({ erro: 'Dados inválidos' });
    }

    try {
      const bloqueio = await consultarBloqueioLogin(parse.data.email);
      if (bloqueio !== null) {
        reply.header('Retry-After', String(bloqueio));
        return reply.status(429).send({
          erro: 'Muitas tentativas incorretas. Tente novamente em até 15 minutos ou use a recuperação de senha.',
          aguardarSegundos: bloqueio,
        });
      }

      const { accessToken, refreshToken } = await autenticar(parse.data.email, parse.data.senha);
      await limparFalhasLogin(parse.data.email);
      definirCookieRefresh(reply, refreshToken);
      return reply.send({ accessToken });
    } catch (err) {
      if (err instanceof AuthError) {
        try {
          const tentativa = await registrarFalhaLogin(parse.data.email);
          if (tentativa.bloqueado) {
            reply.header('Retry-After', String(tentativa.aguardarSegundos));
            return reply.status(429).send({
              erro: 'Limite de 5 tentativas incorretas atingido. Aguarde até 15 minutos e tente novamente.',
              aguardarSegundos: tentativa.aguardarSegundos,
            });
          }

          const restantes = tentativa.restantes;
          return reply.status(401).send({
            erro: `E-mail ou senha inválidos. Restam ${restantes} tentativa${restantes === 1 ? '' : 's'} antes do bloqueio temporário.`,
            tentativasRestantes: restantes,
          });
        } catch (erroContador) {
          request.log.error(erroContador);
          return reply.status(503).send({
            erro: 'Não foi possível validar o limite de tentativas no momento. Tente novamente mais tarde.',
          });
        }
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
      if (err instanceof AuthError) {
        return reply.status(401).send({ erro: 'Sessão inválida, faça login novamente' });
      }
      request.log.error({ err }, 'Falha temporária ao renovar sessão');
      return reply.status(503).send({ erro: 'Não foi possível renovar a sessão agora. Tente novamente.' });
    }
  });

  app.post('/auth/logout', async (request, reply) => {
    const tokenRefresh = request.cookies[COOKIE_REFRESH_NOME];
    try {
      if (tokenRefresh) {
        await revogarTokenRefresh(tokenRefresh);
      }
      const tokenAcesso = request.headers.authorization;
      if (tokenAcesso?.startsWith('Bearer ')) {
        await revogarTokenDeAcesso(tokenAcesso.slice(7));
      }
      reply.clearCookie(COOKIE_REFRESH_NOME, { path: '/' });
      return reply.send({ ok: true });
    } catch (err) {
      request.log.error(err);
      // Se Redis falhar, não apresentar logout como concluído.
      return reply.status(503).send({ erro: 'Não foi possível encerrar a sessão. Tente novamente.' });
    }
  });

  app.post('/auth/esqueci-senha', limiteAutenticacao, async (request, reply) => {
    const parse = solicitarRecuperacaoSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados inválidos' });
    }

    try {
      await solicitarRecuperacaoSenha(parse.data.email);
    } catch (err) {
      // Não registrar URLs de reset, tokens nem endereços de e-mail
      // em logs de erros do provedor ou do banco.
      request.log.warn({ tipo: err instanceof Error ? err.name : 'desconhecido' },
        'Não foi possível enviar a recuperação de senha');
    }

    return reply.send({ ok: true, mensagem: 'Se o e-mail existir, enviamos um link de recuperação.' });
  });

  app.post('/auth/redefinir-senha', limiteAutenticacao, async (request, reply) => {
    const parse = redefinirSenhaSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados inválidos' });
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
