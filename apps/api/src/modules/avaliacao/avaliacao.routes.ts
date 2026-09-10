import type { FastifyInstance } from 'fastify';
import { criarAvaliacaoSchema } from './avaliacao.schemas.js';
import {
  avaliarComoCliente,
  avaliarComoProfissional,
  listarAvaliacoesDoProfissional,
  AvaliacaoError,
} from './avaliacao.service.js';

export async function avaliacaoRoutes(app: FastifyInstance) {
  const somenteCliente = [app.exigirAutenticacao, app.exigirTipo(['CLIENTE'])];
  const somenteProfissional = [app.exigirAutenticacao, app.exigirTipo(['PROFISSIONAL'])];

  app.post('/avaliacoes/cliente', { preHandler: somenteCliente }, async (request, reply) => {
    const parse = criarAvaliacaoSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos', detalhes: parse.error.flatten() });
    }

    try {
      const avaliacao = await avaliarComoCliente(request.usuario!.id, parse.data);
      return reply.status(201).send(avaliacao);
    } catch (err) {
      if (err instanceof AvaliacaoError) {
        return reply.status(err.status).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao avaliar' });
    }
  });

  app.post('/avaliacoes/profissional', { preHandler: somenteProfissional }, async (request, reply) => {
    const parse = criarAvaliacaoSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos', detalhes: parse.error.flatten() });
    }

    try {
      const avaliacao = await avaliarComoProfissional(request.usuario!.id, parse.data);
      return reply.status(201).send(avaliacao);
    } catch (err) {
      if (err instanceof AvaliacaoError) {
        return reply.status(err.status).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao avaliar' });
    }
  });

  app.get('/profissionais/:id/avaliacoes', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const avaliacoes = await listarAvaliacoesDoProfissional(id);
      return reply.send(avaliacoes);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao listar avaliacoes' });
    }
  });
}
