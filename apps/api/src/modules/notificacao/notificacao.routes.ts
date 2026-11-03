import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const parametrosLista = z.object({
  limite: z.coerce.number().int().min(1).max(30).default(15),
});
const parametrosId = z.object({ id: z.string().uuid() });

export async function notificacaoRoutes(app: FastifyInstance) {
  const autenticado = { preHandler: app.exigirAutenticacao };

  // A consulta usa o usuário extraído do token; não aceita IDs de terceiros.
  app.get('/notificacoes', autenticado, async (request, reply) => {
    const parsed = parametrosLista.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ erro: 'Limite de notificações inválido' });
    }
    const destinatarioId = request.usuario!.id;
    try {
      const [itens, naoLidas] = await prisma.$transaction([
        prisma.notificacao.findMany({
          where: { destinatarioId },
          orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
          take: parsed.data.limite,
          select: {
            id: true,
            tipo: true,
            titulo: true,
            mensagem: true,
            solicitacaoId: true,
            lidaEm: true,
            criadoEm: true,
          },
        }),
        prisma.notificacao.count({ where: { destinatarioId, lidaEm: null } }),
      ]);
      return reply.send({ itens, naoLidas });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Não foi possível carregar as notificações' });
    }
  });

  app.patch('/notificacoes/:id/lida', autenticado, async (request, reply) => {
    const parsed = parametrosId.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ erro: 'Notificação inválida' });
    }
    try {
      // Uma notificação só pode ser marcada pelo próprio destinatário.
      const existe = await prisma.notificacao.findFirst({
        where: { id: parsed.data.id, destinatarioId: request.usuario!.id },
        select: { id: true },
      });
      if (!existe) {
        return reply.status(404).send({ erro: 'Notificação não encontrada' });
      }
      await prisma.notificacao.updateMany({
        where: { id: parsed.data.id, destinatarioId: request.usuario!.id, lidaEm: null },
        data: { lidaEm: new Date() },
      });
      return reply.send({ ok: true });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Não foi possível marcar a notificação como lida' });
    }
  });

  app.post('/notificacoes/marcar-todas', autenticado, async (request, reply) => {
    try {
      const atualizadas = await prisma.notificacao.updateMany({
        where: { destinatarioId: request.usuario!.id, lidaEm: null },
        data: { lidaEm: new Date() },
      });
      return reply.send({ ok: true, atualizadas: atualizadas.count });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Não foi possível marcar as notificações como lidas' });
    }
  });
}
