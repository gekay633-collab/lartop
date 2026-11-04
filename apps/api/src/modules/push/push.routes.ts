import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import {
  cadastrarAssinaturaPush, chavePublicaPush,
  removerAssinaturaPush, PushError,
} from './push.service.js';

const assinaturaSchema = z.object({
  endpoint: z.string().url().max(1500),
  keys: z.object({
    p256dh: z.string().min(40).max(250).regex(/^[a-zA-Z0-9_-]+$/),
    auth: z.string().min(10).max(90).regex(/^[a-zA-Z0-9_-]+$/),
  }),
});
const removerSchema = z.object({ endpoint: z.string().url().max(1500) });

export async function pushRoutes(app: FastifyInstance) {
  // Só a chave pública é exposta. A privada reside exclusivamente no Railway.
  app.get('/push/chave-publica', async (_request, reply) => {
    const chave = chavePublicaPush();
    if (!chave) return reply.status(503).send({ erro: 'Notificações push não configuradas' });
    return reply.send({ chave });
  });

  const guard = [
    app.exigirAutenticacao,
    async (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
      const user = await prisma.usuario.findUnique({
        where: { id: request.usuario!.id }, select: { ativo: true },
      });
      if (!user?.ativo) return reply.status(403).send({ erro: 'Conta inativa' });
    },
  ];

  app.post('/push/assinaturas', { preHandler: guard }, async (request, reply) => {
    const parsed = assinaturaSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ erro: 'Assinatura inválida' });
    try {
      await cadastrarAssinaturaPush(request.usuario!.id, parsed.data);
      return reply.status(201).send({ ok: true });
    } catch (e) {
      if (e instanceof PushError) return reply.status(e.status).send({ erro: e.message });
      request.log.error(e);
      return reply.status(500).send({ erro: 'Falha ao ativar alertas' });
    }
  });

  app.delete('/push/assinaturas', { preHandler: guard }, async (request, reply) => {
    const parsed = removerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ erro: 'Assinatura inválida' });
    try {
      await removerAssinaturaPush(request.usuario!.id, parsed.data.endpoint);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error(e);
      return reply.status(500).send({ erro: 'Falha ao desativar alertas' });
    }
  });
}
