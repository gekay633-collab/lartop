import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verificarAccessToken } from '../lib/jwt.js';

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

    try {
      const payload = verificarAccessToken(auth.slice(7));
      request.usuario = { id: payload.sub, tipo: payload.tipo };
    } catch {
      return reply.status(401).send({ erro: 'Token de acesso invalido ou expirado' });
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
