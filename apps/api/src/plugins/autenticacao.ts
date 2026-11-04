import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verificarAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { tokenDeAcessoRevogado } from '../modules/auth/auth.service.js';

interface UsuarioAutenticado {
  id: string;
  tipo: 'CLIENTE' | 'PROFISSIONAL' | 'ADMIN';
}

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: UsuarioAutenticado;
  }
}

async function autenticacaoPlugin(app: FastifyInstance) {
  app.decorate('exigirAutenticacao', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return reply.status(401).send({ erro: 'Token de acesso ausente' });
    }

    const token = auth.slice(7);
    let payload: ReturnType<typeof verificarAccessToken>;
    try {
      payload = verificarAccessToken(token);
    } catch {
      return reply.status(401).send({ erro: 'Token de acesso inválido ou expirado' });
    }

    try {
      const [revogado, usuario] = await Promise.all([
        tokenDeAcessoRevogado(token),
        prisma.usuario.findUnique({
          where: { id: payload.sub },
          select: { tipo: true, ativo: true },
        }),
      ]);
      if (revogado || !usuario?.ativo || usuario.tipo !== payload.tipo) {
        return reply.status(401).send({ erro: 'Sessão inválida ou conta desativada' });
      }
      request.usuario = { id: payload.sub, tipo: usuario.tipo };
    } catch (err) {
      request.log.error(err);
      return reply.status(503).send({ erro: 'Não foi possível validar sua sessão agora' });
    }
  });

  app.decorate('exigirTipo', (tipos: UsuarioAutenticado['tipo'][]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.usuario || !tipos.includes(request.usuario.tipo)) {
        return reply.status(403).send({ erro: 'Acesso nao permitido para este tipo de usuario' });
      }
    };
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    exigirAutenticacao: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    exigirTipo: (tipos: UsuarioAutenticado['tipo'][]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(autenticacaoPlugin);
