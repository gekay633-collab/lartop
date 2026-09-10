import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listarPrestadoresQuerySchema,
  listarClientesQuerySchema,
  alternarBloqueioSchema,
  criarCategoriaSchema,
  atualizarCategoriaSchema,
} from './admin.schemas.js';
import {
  obterDashboard,
  listarPrestadores,
  listarClientes,
  alternarBloqueioUsuario,
  alternarPublicacaoPrestador,
  listarCategoriasAdmin,
  criarCategoria,
  atualizarCategoria,
  obterOfertaDemanda,
  AdminError,
} from './admin.service.js';

const alternarPublicacaoSchema = z.object({ publicado: z.boolean() });

export async function adminRoutes(app: FastifyInstance) {
  const somenteAdmin = [app.exigirAutenticacao, app.exigirTipo(['ADMIN'])];

  app.get('/admin/dashboard', { preHandler: somenteAdmin }, async (request, reply) => {
    try {
      const dados = await obterDashboard();
      return reply.send(dados);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao carregar dashboard' });
    }
  });

  app.get('/admin/oferta-demanda', { preHandler: somenteAdmin }, async (request, reply) => {
    try {
      const dados = await obterOfertaDemanda();
      return reply.send(dados);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao carregar oferta e demanda' });
    }
  });

  app.get('/admin/prestadores', { preHandler: somenteAdmin }, async (request, reply) => {
    const parse = listarPrestadoresQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Parametros invalidos' });
    }
    try {
      const resultado = await listarPrestadores(parse.data);
      return reply.send(resultado);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao listar prestadores' });
    }
  });

  app.patch('/admin/prestadores/:id/publicacao', { preHandler: somenteAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = alternarPublicacaoSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos' });
    }
    try {
      const perfil = await alternarPublicacaoPrestador(id, parse.data.publicado);
      return reply.send(perfil);
    } catch (err) {
      if (err instanceof AdminError) {
        return reply.status(err.status).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao atualizar publicacao' });
    }
  });

  app.get('/admin/clientes', { preHandler: somenteAdmin }, async (request, reply) => {
    const parse = listarClientesQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Parametros invalidos' });
    }
    try {
      const resultado = await listarClientes(parse.data);
      return reply.send(resultado);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao listar clientes' });
    }
  });

  app.patch('/admin/usuarios/:id/bloqueio', { preHandler: somenteAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = alternarBloqueioSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos' });
    }
    try {
      const usuario = await alternarBloqueioUsuario(id, parse.data.ativo);
      return reply.send(usuario);
    } catch (err) {
      if (err instanceof AdminError) {
        return reply.status(err.status).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao atualizar bloqueio' });
    }
  });

  app.get('/admin/categorias', { preHandler: somenteAdmin }, async (request, reply) => {
    try {
      const categorias = await listarCategoriasAdmin();
      return reply.send(categorias);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao listar categorias' });
    }
  });

  app.post('/admin/categorias', { preHandler: somenteAdmin }, async (request, reply) => {
    const parse = criarCategoriaSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos' });
    }
    try {
      const categoria = await criarCategoria(parse.data);
      return reply.status(201).send(categoria);
    } catch (err) {
      if (err instanceof AdminError) {
        return reply.status(err.status).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao criar categoria' });
    }
  });

  app.patch('/admin/categorias/:id', { preHandler: somenteAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = atualizarCategoriaSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados invalidos' });
    }
    try {
      const categoria = await atualizarCategoria(id, parse.data);
      return reply.send(categoria);
    } catch (err) {
      if (err instanceof AdminError) {
        return reply.status(err.status).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao atualizar categoria' });
    }
  });
}
