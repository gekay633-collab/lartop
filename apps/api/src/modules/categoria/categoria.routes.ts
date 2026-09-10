import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export async function categoriaRoutes(app: FastifyInstance) {
  app.get('/categorias', async (request, reply) => {
    const categorias = await prisma.categoria.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, slug: true },
    });
    return reply.send(categorias);
  });
}
