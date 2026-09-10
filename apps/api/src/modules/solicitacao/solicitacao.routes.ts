import type { FastifyInstance } from 'fastify';
import {
  criarSolicitacaoSchema,
  atualizarStatusSchema,
  listarSolicitacoesQuerySchema,
} from './solicitacao.schemas.js';
import {
  criarSolicitacao,
  listarSolicitacoesRecebidas,
  listarMinhasSolicitacoes,
  atualizarStatusComoProfissional,
  cancelarComoCliente,
  SolicitacaoError,
} from './solicitacao.service.js';

export async function solicitacaoRoutes(app: FastifyInstance) {
  const somenteCliente = [app.exigirAutenticacao, app.exigirTipo(['CLIENTE'])];
  const somenteProfissional = [app.exigirAutenticacao, app.exigirTipo(['PROFISSIONAL'])];

  app.post('/solicitacoes', { preHandler: somenteCliente }, async (request, reply) => {
    const parse = criarSolicitacaoSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos', detalhes: parse.error.flatten() });
    }

    try {
      const solicitacao = await criarSolicitacao(request.usuario!.id, parse.data);
      return reply.status(201).send(solicitacao);
    } catch (err) {
      if (err instanceof SolicitacaoError) {
        return reply.status(err.status).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao criar solicitacao' });
    }
  });

  app.get('/solicitacoes/recebidas', { preHandler: somenteProfissional }, async (request, reply) => {
    const parse = listarSolicitacoesQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Parametros invalidos' });
    }

    try {
      const resultado = await listarSolicitacoesRecebidas(request.usuario!.id, parse.data);
      return reply.send(resultado);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao listar solicitacoes' });
    }
  });

  app.get('/solicitacoes/minhas', { preHandler: somenteCliente }, async (request, reply) => {
    const parse = listarSolicitacoesQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Parametros invalidos' });
    }

    try {
      const resultado = await listarMinhasSolicitacoes(request.usuario!.id, parse.data);
      return reply.send(resultado);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao listar solicitacoes' });
    }
  });

  app.patch(
    '/solicitacoes/:id/status',
    { preHandler: somenteProfissional },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = atualizarStatusSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ erro: 'Dados invalidos', detalhes: parse.error.flatten() });
      }

      try {
        const solicitacao = await atualizarStatusComoProfissional(request.usuario!.id, id, parse.data);
        return reply.send(solicitacao);
      } catch (err) {
        if (err instanceof SolicitacaoError) {
          return reply.status(err.status).send({ erro: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ erro: 'Erro interno ao atualizar status' });
      }
    }
  );

  app.post(
    '/solicitacoes/:id/cancelar',
    { preHandler: somenteCliente },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const solicitacao = await cancelarComoCliente(request.usuario!.id, id);
        return reply.send(solicitacao);
      } catch (err) {
        if (err instanceof SolicitacaoError) {
          return reply.status(err.status).send({ erro: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ erro: 'Erro interno ao cancelar solicitacao' });
      }
    }
  );
}
