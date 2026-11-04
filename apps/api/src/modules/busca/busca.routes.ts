import type { FastifyInstance } from 'fastify';
import { buscarProfissionaisSchema, buscarProfissionaisPorCidadeSchema, cidadeParamsSchema } from './busca.schemas.js';
import { buscarProfissionaisPorCep, buscarProfissionaisPorCidadeSlug, BuscaError } from './busca.service.js';

export async function buscaRoutes(app: FastifyInstance) {
  app.get('/profissionais/buscar', async (request, reply) => {
    const parse = buscarProfissionaisSchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Parâmetros inválidos', detalhes: parse.error.flatten() });
    }

    try {
      const resultado = await buscarProfissionaisPorCep(parse.data);
      return reply.send(resultado);
    } catch (err) {
      if (err instanceof BuscaError) {
        return reply.status(err.status).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno na busca' });
    }
  });

  app.get('/cidades/:estado/:cidadeSlug/profissionais', async (request, reply) => {
    const params = cidadeParamsSchema.safeParse(request.params);
    const query = buscarProfissionaisPorCidadeSchema.safeParse(request.query);
    if (!params.success || !query.success) {
      return reply.status(400).send({ erro: 'Parâmetros de busca inválidos' });
    }

    try {
      const resultado = await buscarProfissionaisPorCidadeSlug({
        ...params.data,
        ...query.data,
      });
      return reply.send(resultado);
    } catch (err) {
      if (err instanceof BuscaError) {
        return reply.status(err.status).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno na busca' });
    }
  });
}
