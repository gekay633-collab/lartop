import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registrarEvento } from './evento.service.js';

const registrarEventoSchema = z.object({
  tipo: z.enum(['PESQUISA', 'VISUALIZACAO_PERFIL']),
  cidadeId: z.string().uuid().optional(),
  categoriaId: z.string().uuid().optional(),
  profissionalId: z.string().uuid().optional(),
});

export async function eventoRoutes(app: FastifyInstance) {
  // Endpoint intencionalmente público para registrar visitas anônimas,
  // mas não pode aceitar volume ilimitado que distorça métricas e encha o banco.
  app.post('/eventos', {
    config: { rateLimit: { max: 15, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parse = registrarEventoSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos' });
    }

    await registrarEvento(parse.data);
    return reply.status(202).send({ ok: true });
  });
}
