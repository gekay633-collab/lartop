import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import {
  cadastrarAssinaturaPush, chavePublicaPush,
  removerAssinaturaPush, PushError,
  agendarPushTeste, consultarPushTeste, confirmarPushTeste,
} from './push.service.js';

const assinaturaSchema = z.object({
  endpoint: z.string().url().max(1500),
  keys: z.object({
    p256dh: z.string().min(40).max(250).regex(/^[a-zA-Z0-9_-]+$/),
    auth: z.string().min(10).max(90).regex(/^[a-zA-Z0-9_-]+$/),
  }),
});
const removerSchema = z.object({ endpoint: z.string().url().max(1500) });
const idTesteSchema = z.object({ id: z.string().uuid() });
const reciboTesteSchema = z.object({
  segredo: z.string().regex(/^[a-f0-9]{64}$/),
  estado: z.enum(['exibida', 'falha']),
});

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

  // O push service pode devolver 410 (Gone). Nesse caso o backend remove a
  // inscrição, mas o navegador pode ainda ter uma cópia local obsoleta.
  // Consulta autenticada sem endpoint na URL/log de acesso.
  app.post('/push/assinaturas/verificar', { preHandler: guard }, async (request, reply) => {
    const parsed = removerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ erro: 'Assinatura inválida' });
    try {
      const registrada = await prisma.assinaturaPush.count({
        where: { usuarioId: request.usuario!.id, endpoint: parsed.data.endpoint },
      });
      return reply.header('Cache-Control', 'no-store').send({ registrada: registrada > 0 });
    } catch (e) {
      request.log.error(e);
      return reply.status(503).send({ erro: 'Não foi possível verificar alertas agora' });
    }
  });

  const guardProfissional = [...guard, app.exigirTipo(['PROFISSIONAL'])];

  // Dispara apenas para a inscrição que pertence à pessoa conectada.
  // Atraso de 12 segundos permite bloquear a tela antes do Push sair da API.
  app.post('/push/teste', { preHandler: guardProfissional }, async (request, reply) => {
    const parsed = removerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ erro: 'Inscrição inválida' });
    try {
      const resultado = await agendarPushTeste(request.usuario!.id, parsed.data.endpoint);
      return reply.header('Cache-Control', 'no-store').status(202).send(resultado);
    } catch (e) {
      if (e instanceof PushError) return reply.status(e.status).send({ erro: e.message });
      request.log.error({ err: e instanceof Error ? e.name : 'desconhecido' }, 'Erro no teste Push');
      return reply.status(503).send({ erro: 'Teste Push indisponível. Tente novamente.' });
    }
  });

  app.get('/push/teste/:id', { preHandler: guardProfissional }, async (request, reply) => {
    const parsed = idTesteSchema.safeParse(request.params);
    if (!parsed.success) return reply.status(400).send({ erro: 'Identificador inválido' });
    try {
      const resultado = await consultarPushTeste(request.usuario!.id, parsed.data.id);
      return reply.header('Cache-Control', 'no-store').send(resultado);
    } catch (e) {
      if (e instanceof PushError) return reply.status(e.status).send({ erro: e.message });
      request.log.error({ err: e instanceof Error ? e.name : 'desconhecido' }, 'Erro ao consultar teste Push');
      return reply.status(503).send({ erro: 'Teste Push indisponível.' });
    }
  });

  // Endpoint sem JWT porque service workers em segundo plano não acessam
  // o localStorage. O segredo é aleatório, por teste, entregue no Push criptografado.
  app.post('/push/teste/:id/confirmar', async (request, reply) => {
    const params = idTesteSchema.safeParse(request.params);
    const body = reciboTesteSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.status(400).send({ erro: 'Confirmação inválida' });
    try {
      await confirmarPushTeste(params.data.id, body.data.segredo, body.data.estado);
      return reply.header('Cache-Control', 'no-store').send({ ok: true });
    } catch (e) {
      if (e instanceof PushError) return reply.status(e.status).send({ erro: e.message });
      request.log.error({ err: e instanceof Error ? e.name : 'desconhecido' }, 'Erro ao confirmar teste Push');
      return reply.status(503).send({ erro: 'Não foi possível registrar a confirmação.' });
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
