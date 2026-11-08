import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { chaveDePedido } from './solicitacao.idempotencia.js';
import { redis } from '../../lib/redis.js';
import {
  criarSolicitacaoSchema,
  atualizarStatusSchema,
  listarSolicitacoesQuerySchema,
} from './solicitacao.schemas.js';
import {
  criarSolicitacao,
  consultarPedidoReenviado,
  listarSolicitacoesRecebidas,
  listarMinhasSolicitacoes,
  atualizarStatusComoProfissional,
  cancelarComoCliente,
  SolicitacaoError,
} from './solicitacao.service.js';

// Evita que uma conta gratuita inunde um prestador com pedidos e Push.
// A contagem é atômica entre réplicas. Não usa IP, que pode ser compartilhado
// por usuários legítimos atrás de proxies ou redes móveis.
const MAX_PEDIDOS_JANELA = 12;
const SCRIPT_LIMITE_PEDIDOS = `
  -- O mesmo UUID do cliente consome apenas uma vaga da janela de 15min.
  if ARGV[3] == '1' and redis.call('EXISTS', KEYS[2]) == 1 then
    return 1
  end
  local quantidade = redis.call('INCR', KEYS[1])
  if quantidade == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end
  if quantidade > tonumber(ARGV[2]) then return 0 end
  if ARGV[3] == '1' then redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[1])) end
  return 1
`;

async function aceitarMaisUmPedido(clienteId: string, chave?: string): Promise<boolean> {
  const deduplicada = chave ? chaveDePedido(clienteId, chave) : 'legado';
  const autorizada = Number(await redis.eval(
    SCRIPT_LIMITE_PEDIDOS, 2,
    `limite:solicitacoes:${clienteId}`,
    `limite:solicitacoes:tentativa:${deduplicada}`,
    '900', String(MAX_PEDIDOS_JANELA), chave ? '1' : '0',
  ));
  return autorizada === 1;
}

export async function solicitacaoRoutes(app: FastifyInstance) {
  const somenteCliente = [app.exigirAutenticacao, app.exigirTipo(['CLIENTE'])];
  const somenteProfissional = [app.exigirAutenticacao, app.exigirTipo(['PROFISSIONAL'])];

  app.post('/solicitacoes', { preHandler: somenteCliente }, async (request, reply) => {
    const parse = criarSolicitacaoSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados inválidos', detalhes: parse.error.flatten() });
    }

    const chaveBruta = request.headers['idempotency-key'];
    const chaveValidada = chaveBruta === undefined ? null : z.string().uuid().safeParse(chaveBruta);
    if (chaveValidada && !chaveValidada.success) {
      return reply.status(400).send({ erro: 'Idempotency-Key deve ser um UUID válido.' });
    }
    const chave = chaveValidada?.success ? chaveValidada.data : undefined;
    try {
      if (chave) {
        const reenviado = await consultarPedidoReenviado(request.usuario!.id, parse.data, chave);
        if (reenviado) return reply.status(200).send(reenviado);
      }
      if (!(await aceitarMaisUmPedido(request.usuario!.id, chave))) {
        // A tentativa original pode ter terminado enquanto checávamos o limite.
        const reenviado = chave
          ? await consultarPedidoReenviado(request.usuario!.id, parse.data, chave) : null;
        if (reenviado) return reply.status(200).send(reenviado);
        return reply.status(429).send({
          erro: 'Muitos pedidos em pouco tempo. Aguarde 15 minutos para tentar novamente.',
        });
      }
      const solicitacao = await criarSolicitacao(request.usuario!.id, parse.data, chave);
      return reply.status(201).send(solicitacao);
    } catch (err) {
      if (err instanceof SolicitacaoError) {
        return reply.status(err.status).send({ erro: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao criar solicitação' });
    }
  });

  app.get('/solicitacoes/recebidas', { preHandler: somenteProfissional }, async (request, reply) => {
    const parse = listarSolicitacoesQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Parâmetros inválidos' });
    }

    try {
      const resultado = await listarSolicitacoesRecebidas(request.usuario!.id, parse.data);
      return reply.send(resultado);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao listar solicitações' });
    }
  });

  app.get('/solicitacoes/minhas', { preHandler: somenteCliente }, async (request, reply) => {
    const parse = listarSolicitacoesQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Parâmetros inválidos' });
    }

    try {
      const resultado = await listarMinhasSolicitacoes(request.usuario!.id, parse.data);
      return reply.send(resultado);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ erro: 'Erro interno ao listar solicitações' });
    }
  });

  app.patch(
    '/solicitacoes/:id/status',
    { preHandler: somenteProfissional },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parse = atualizarStatusSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ erro: 'Dados inválidos', detalhes: parse.error.flatten() });
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
        return reply.status(500).send({ erro: 'Erro interno ao cancelar solicitação' });
      }
    }
  );
}
