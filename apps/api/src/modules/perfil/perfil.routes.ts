import type { FastifyInstance } from 'fastify';
import {
  atualizarPerfilSchema,
  definirCategoriasSchema,
  adicionarFotoPortfolioSchema,
} from './perfil.schemas.js';
import {
  obterPerfilProprio,
  obterPerfilPublico,
  atualizarPerfil,
  definirCategorias,
  adicionarFotoPortfolio,
  publicarPerfil,
  despublicarPerfil,
  PerfilError,
} from './perfil.service.js';

export async function perfilRoutes(app: FastifyInstance) {
  const somenteProfissional = [app.exigirAutenticacao, app.exigirTipo(['PROFISSIONAL'])];

  app.get('/perfil/mim', { preHandler: somenteProfissional }, async (request, reply) => {
    try {
      const perfil = await obterPerfilProprio(request.usuario!.id);
      return reply.send(perfil);
    } catch (err) {
      if (err instanceof PerfilError) {
        return reply.status(404).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao obter perfil' });
    }
  });

  app.get('/profissionais/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const perfil = await obterPerfilPublico(id);
      return reply.send(perfil);
    } catch (err) {
      if (err instanceof PerfilError) {
        return reply.status(404).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao obter perfil' });
    }
  });

  app.patch('/perfil/mim', { preHandler: somenteProfissional }, async (request, reply) => {
    const parse = atualizarPerfilSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos', detalhes: parse.error.flatten() });
    }

    try {
      const perfil = await atualizarPerfil(request.usuario!.id, parse.data);
      return reply.send(perfil);
    } catch (err) {
      if (err instanceof PerfilError) {
        return reply.status(404).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao atualizar perfil' });
    }
  });

  app.put('/perfil/mim/categorias', { preHandler: somenteProfissional }, async (request, reply) => {
    const parse = definirCategoriasSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos', detalhes: parse.error.flatten() });
    }

    try {
      const perfil = await definirCategorias(request.usuario!.id, parse.data);
      return reply.send(perfil);
    } catch (err) {
      if (err instanceof PerfilError) {
        return reply.status(404).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao definir categorias' });
    }
  });

  app.post('/perfil/mim/fotos', { preHandler: somenteProfissional }, async (request, reply) => {
    const parse = adicionarFotoPortfolioSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos', detalhes: parse.error.flatten() });
    }

    try {
      const foto = await adicionarFotoPortfolio(request.usuario!.id, parse.data);
      return reply.status(201).send(foto);
    } catch (err) {
      if (err instanceof PerfilError) {
        return reply.status(404).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao adicionar foto' });
    }
  });

  app.post('/perfil/mim/publicar', { preHandler: somenteProfissional }, async (request, reply) => {
    try {
      const perfil = await publicarPerfil(request.usuario!.id);
      return reply.send(perfil);
    } catch (err) {
      if (err instanceof PerfilError) {
        return reply.status(400).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao publicar perfil' });
    }
  });

  app.post('/perfil/mim/despublicar', { preHandler: somenteProfissional }, async (request, reply) => {
    try {
      const perfil = await despublicarPerfil(request.usuario!.id);
      return reply.send(perfil);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao despublicar perfil' });
    }
  });
}
