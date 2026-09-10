import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export async function usuarioRoutes(app: FastifyInstance) {
  app.get('/usuarios/mim', { preHandler: app.exigirAutenticacao }, async (request, reply) => {
    const usuario = await prisma.usuario.findUnique({
      where: { id: request.usuario!.id },
      select: { id: true, nome: true, email: true, tipo: true, telefone: true },
    });

    if (!usuario) {
      return reply.status(404).send({ erro: 'Usuario nao encontrado' });
    }

    return reply.send(usuario);
  });
}
