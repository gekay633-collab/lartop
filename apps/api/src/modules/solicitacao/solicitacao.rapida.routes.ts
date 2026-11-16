import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  criarSolicitacaoRapidaSchema,
  acompanharSolicitacaoRapidaSchema,
} from './solicitacao.rapida.schemas.js';
import {
  consultarReenvioRapido,
  permitirPedidoRapido,
  criarSolicitacaoRapida,
  acompanharSolicitacaoRapida,
  SolicitacaoRapidaError,
} from './solicitacao.rapida.service.js';

export async function solicitacaoRapidaRoutes(app: FastifyInstance) {
  // Endpoint público: não cria conta, cookie ou sessão e não solicita e-mail/senha.
  app.post('/solicitacoes/rapidas', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = criarSolicitacaoRapidaSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ erro: 'Confira nome, WhatsApp e descrição.' });

    try {
      // Reenvio (timeout / clique duplo) retorna o pedido antigo sem duplicar aviso.
      const repetido = await consultarReenvioRapido(parsed.data);
      reply.header('Cache-Control', 'no-store');
      if (repetido) return reply.status(200).send(repetido);

      if (!(await permitirPedidoRapido(parsed.data.profissionalId, parsed.data.whatsapp))) {
        // Pode ter sido salvo em outra requisição simultânea.
        const reenviado = await consultarReenvioRapido(parsed.data);
        if (reenviado) return reply.status(200).send(reenviado);
        return reply.status(429).send({ erro: 'Limite de solicitações atingido. Tente novamente mais tarde.' });
      }

      const pedido = await criarSolicitacaoRapida(parsed.data);
      return reply.status(201).send(pedido);
    } catch (erro) {
      if (erro instanceof SolicitacaoRapidaError) {
        return reply.status(erro.status).send({ erro: erro.message });
      }
      request.log.error({ err: erro }, 'Falha no pedido rápido');
      return reply.status(503).send({ erro: 'Não foi possível registrar o pedido agora. Tente novamente.' });
    }
  });

  // POST para que o token de acesso não apareça em logs HTTP, URLs ou referers.
  // O token é mantido apenas no fragmento (#) da URL pelo navegador do cliente.
  app.post('/solicitacoes/rapidas/:id/acompanhar', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parametro = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const body = acompanharSolicitacaoRapidaSchema.safeParse(request.body);
    reply.header('Cache-Control', 'no-store');
    if (!parametro.success || !body.success) return reply.status(400).send({ erro: 'Link inválido.' });
    try {
      return reply.send(await acompanharSolicitacaoRapida(parametro.data.id, body.data.token));
    } catch (erro) {
      if (erro instanceof SolicitacaoRapidaError) {
        return reply.status(erro.status).send({ erro: erro.message });
      }
      request.log.error({ err: erro }, 'Falha no acompanhamento do pedido');
      return reply.status(503).send({ erro: 'Acompanhamento temporariamente indisponível.' });
    }
  });
}
