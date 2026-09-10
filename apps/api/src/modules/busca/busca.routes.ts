import type { FastifyInstance } from 'fastify';
import { buscarProfissionaisSchema } from './busca.schemas.js';
import { buscarProfissionaisPorCep, buscarProfissionaisPorCidadeSlug, BuscaError } from './busca.service.js';

export async function buscaRoutes(app: FastifyInstance) {
  app.get('/profissionais/buscar', async (request, reply) => {
    const parse = buscarProfissionaisSchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Parametros invalidos', detalhes: parse.error.flatten() });
    }

    try {
      const resultado = await buscarProfissionaisPorCep(parse.data);
      return reply.send(resultado);
    } catch (err) {
      if (err instanceof BuscaError) {
        return reply.status(404).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno na busca' });
    }
  });

  app.get('/cidades/:estado/:cidadeSlug/profissionais', async (request, reply) => {
    const { estado, cidadeSlug } = request.params as { estado: string; cidadeSlug: string };
    const query = request.query as { categoria?: string; raioKm?: string; pagina?: string; porPagina?: string };

    try {
      const resultado = await buscarProfissionaisPorCidadeSlug({
        estado,
        cidadeSlug,
        categoria: query.categoria,
        raioKm: query.raioKm ? Number(query.raioKm) : undefined,
        pagina: query.pagina ? Number(query.pagina) : undefined,
        porPagina: query.porPagina ? Number(query.porPagina) : undefined,
      });
      return reply.send(resultado);
    } catch (err) {
      if (err instanceof BuscaError) {
        return reply.status(404).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno na busca' });
    }
  });
}
