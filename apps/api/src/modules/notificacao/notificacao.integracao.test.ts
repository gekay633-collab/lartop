import { randomUUID } from 'node:crypto';
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import autenticacaoPlugin from '../../plugins/autenticacao.js';
import { gerarAccessToken, versaoCredenciais } from '../../lib/jwt.js';
import { emitirTokens } from '../auth/auth.service.js';
import { solicitacaoRoutes } from '../solicitacao/solicitacao.routes.js';
import { notificacaoRoutes } from './notificacao.routes.js';
import { pushRoutes } from '../push/push.routes.js';
import {
  criarSolicitacao,
  atualizarStatusComoProfissional,
  cancelarComoCliente,
  SolicitacaoError,
} from '../solicitacao/solicitacao.service.js';

/**
 * Integração real com Prisma e PostgreSQL, MAS SOMENTE EM BANCO LOCAL DESCARTÁVEL.
 * O teste falha imediatamente se alguém tentar apontá-lo ao Supabase ou Railway.
 */
const rawUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_DATABASE_URL;
if (process.env.NOTIFICACOES_TEST_DB !== 'isolated' || !rawUrl || !directUrl ||
    !['localhost', '127.0.0.1'].includes(new URL(rawUrl).hostname) ||
    !['localhost', '127.0.0.1'].includes(new URL(directUrl).hostname)) {
  throw new Error('Testes de integração exigem PostgreSQL local isolado; produção está bloqueada.');
}

describe('central de notificações com banco de testes', () => {
  let app: ReturnType<typeof Fastify>;
  let clienteId = '';
  let profissionalId = '';
  let categoriaId = '';
  let cidadeId = '';
  let clienteToken = '';
  let profissionalToken = '';
  const suffix = randomUUID().slice(0, 12);

  const entrada = () => ({
    profissionalId,
    categoriaId,
    cep: '24900000',
    endereco: 'Endereço fictício de teste, 42',
    tamanhoM2: 75,
    descricao: 'Solicitação automatizada para testes',
    fotos: [],
  });

  async function pedidosCriados(): Promise<number> {
    return prisma.solicitacaoOrcamento.count({ where: { clienteId } });
  }

  before(async () => {
    app = Fastify({ logger: false });
    await app.register(autenticacaoPlugin);
    await app.register(notificacaoRoutes, { prefix: '/api' });
    await app.register(solicitacaoRoutes, { prefix: '/api' });
    await app.register(pushRoutes, { prefix: '/api' });
    await app.ready();

    const cidade = await prisma.cidade.create({
      data: { nome: 'Cidade teste', estado: 'RJ', slug: `ci-notif-${suffix}`, lat: -22.9, lng: -42.8 },
    });
    cidadeId = cidade.id;
    const categoria = await prisma.categoria.create({
      data: { nome: 'Serviço teste', slug: `servico-notif-${suffix}` },
    });
    categoriaId = categoria.id;

    const cliente = await prisma.usuario.create({
      data: { email: `cliente-notif-${suffix}@example.test`, senhaHash: 'nao-usada',
        nome: 'Cliente de Teste', tipo: 'CLIENTE' },
    });
    clienteId = cliente.id;

    const profissional = await prisma.usuario.create({
      data: { email: `prof-notif-${suffix}@example.test`, senhaHash: 'nao-usada',
        nome: 'Profissional de Teste', tipo: 'PROFISSIONAL', telefone: '21999998888' },
    });
    profissionalId = profissional.id;

    await prisma.perfilProfissional.create({
      data: { usuarioId: profissionalId, nomeExibicao: 'Profissional teste',
        cepBase: '24900000', cidadeId, lat: -22.9, lng: -42.8,
        perfilPublicado: true },
    });
    await prisma.profissionalCategoria.create({
      data: { profissionalId, categoriaId },
    });

    clienteToken = (await emitirTokens(clienteId, 'CLIENTE')).accessToken;
    profissionalToken = (await emitirTokens(profissionalId, 'PROFISSIONAL')).accessToken;
  });

  after(async () => {
    if (app) await app.close();
    // Remoção restrita exclusivamente aos dados criados por este teste.
    if (clienteId && profissionalId) {
      await prisma.solicitacaoOrcamento.deleteMany({ where: { clienteId } });
      await prisma.notificacao.deleteMany({ where: { destinatarioId: { in: [clienteId, profissionalId] } } });
      await prisma.profissionalCategoria.deleteMany({ where: { profissionalId } });
      await prisma.perfilProfissional.deleteMany({ where: { usuarioId: profissionalId } });
      await prisma.usuario.deleteMany({ where: { id: { in: [clienteId, profissionalId] } } });
    }
    if (categoriaId) await prisma.categoria.deleteMany({ where: { id: categoriaId } });
    if (cidadeId) await prisma.cidade.deleteMany({ where: { id: cidadeId } });
    await prisma.$disconnect();
    redis.disconnect();
  });

  it('bloqueia tokens de contas desativadas e papéis incompatíveis', async () => {
    const tokenFalsoAdmin = gerarAccessToken({ sub: clienteId, tipo: 'ADMIN', credenciaisVersao: versaoCredenciais('nao-usada') });
    const acessoPapelErrado = await app.inject({
      method: 'GET', url: '/api/notificacoes',
      headers: { authorization: `Bearer ${tokenFalsoAdmin}` },
    });
    assert.equal(acessoPapelErrado.statusCode, 401);

    await prisma.usuario.update({ where: { id: clienteId }, data: { ativo: false } });
    try {
      const acessoContaBloqueada = await app.inject({
        method: 'GET', url: '/api/notificacoes',
        headers: { authorization: `Bearer ${clienteToken}` },
      });
      assert.equal(acessoContaBloqueada.statusCode, 401);
    } finally {
      await prisma.usuario.update({ where: { id: clienteId }, data: { ativo: true } });
    }
  });

  it('mantém RLS ativo na nova tabela de notificações', async () => {
    const verificacao = await prisma.$queryRaw<Array<{ ativo: boolean }>>`
      SELECT c.relrowsecurity AS ativo
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'notificacoes'
    `;
    assert.equal(verificacao.length, 1);
    assert.equal(verificacao[0]?.ativo, true);
  });

  it('não permite prestador contratar nem solicitar orçamento para si mesmo', async () => {
    const pedidosAntes = await prisma.solicitacaoOrcamento.count();
    const avisosAntes = await prisma.notificacao.count();

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/solicitacoes',
      headers: { authorization: `Bearer ${profissionalToken}` },
      payload: entrada(),
    });
    assert.equal(resposta.statusCode, 403, 'a API aceita solicitações apenas de clientes');

    await assert.rejects(
      criarSolicitacao(profissionalId, entrada()),
      (erro: unknown) => erro instanceof SolicitacaoError && erro.status === 403,
      'a camada de serviço também deve impedir pedidos para o próprio perfil'
    );

    assert.equal(await prisma.solicitacaoOrcamento.count(), pedidosAntes);
    assert.equal(await prisma.notificacao.count(), avisosAntes);
  });

  it('gera aviso de novo pedido somente para o prestador', async () => {
    const pedido = await criarSolicitacao(clienteId, entrada());
    assert.equal(pedido.status, 'PENDENTE');
    const itens = await prisma.notificacao.findMany({ where: { solicitacaoId: pedido.id } });
    assert.equal(itens.length, 1);
    assert.equal(itens[0]?.destinatarioId, profissionalId);
    assert.equal(itens[0]?.tipo, 'NOVA_SOLICITACAO');
    assert.match(pedido.linkWhatsapp, /^https:\/\/wa\.me\//);
    assert.doesNotMatch(itens[0]?.mensagem ?? '', /24900000|21999998888/);

    const semToken = await app.inject({ method: 'GET', url: '/api/notificacoes' });
    assert.equal(semToken.statusCode, 401);

    const respostaCliente = await app.inject({
      method: 'GET', url: '/api/notificacoes',
      headers: { authorization: `Bearer ${clienteToken}` },
    });
    assert.equal(respostaCliente.statusCode, 200);
    const listaCliente = respostaCliente.json() as { itens: { id: string }[] };
    assert.equal(listaCliente.itens.length, 0);

    const respostaProfissional = await app.inject({
      method: 'GET', url: '/api/notificacoes',
      headers: { authorization: `Bearer ${profissionalToken}` },
    });
    assert.equal(respostaProfissional.statusCode, 200);
    const listaPrestador = respostaProfissional.json() as { itens: { id: string }[]; naoLidas: number };
    assert.equal(listaPrestador.itens.length, 1);
    assert.equal(listaPrestador.naoLidas, 1);

    const tentativaOutroUsuario = await app.inject({
      method: 'PATCH', url: `/api/notificacoes/${itens[0].id}/lida`,
      headers: { authorization: `Bearer ${clienteToken}` },
    });
    assert.equal(tentativaOutroUsuario.statusCode, 404);

    const marcarLida = await app.inject({
      method: 'PATCH', url: `/api/notificacoes/${itens[0].id}/lida`,
      headers: { authorization: `Bearer ${profissionalToken}` },
    });
    assert.equal(marcarLida.statusCode, 200);
    assert.notEqual((await prisma.notificacao.findUniqueOrThrow({ where: { id: itens[0].id } })).lidaEm, null);

    const novamente = await app.inject({
      method: 'PATCH', url: `/api/notificacoes/${itens[0].id}/lida`,
      headers: { authorization: `Bearer ${profissionalToken}` },
    });
    assert.equal(novamente.statusCode, 200);
  });

  it('aceite e conclusão geram dois avisos para o cliente e não permitem repetição', async () => {
    const pedido = await criarSolicitacao(clienteId, entrada());
    await atualizarStatusComoProfissional(profissionalId, pedido.id, { status: 'ACEITA' });
    await atualizarStatusComoProfissional(profissionalId, pedido.id, { status: 'CONCLUIDA' });
    const eventos = await prisma.notificacao.findMany({ where: { solicitacaoId: pedido.id } });
    assert.deepEqual(eventos.filter(x => x.destinatarioId === clienteId).map(x => x.tipo).sort(),
      ['SOLICITACAO_ACEITA', 'SOLICITACAO_CONCLUIDA'].sort());

    await assert.rejects(
      atualizarStatusComoProfissional(profissionalId, pedido.id, { status: 'CONCLUIDA' }),
      (erro: unknown) => erro instanceof SolicitacaoError && erro.status === 400,
    );
    assert.equal(await prisma.notificacao.count({ where: { solicitacaoId: pedido.id } }), 3);
  });

  it('resposta e recusa geram avisos para o cliente; cancelamento avisa o prestador', async () => {
    const pedido = await criarSolicitacao(clienteId, entrada());
    await atualizarStatusComoProfissional(profissionalId, pedido.id, { status: 'RESPONDIDA' });
    await atualizarStatusComoProfissional(profissionalId, pedido.id, { status: 'RECUSADA' });
    const tipos = (await prisma.notificacao.findMany({ where: { solicitacaoId: pedido.id } }))
      .filter(x => x.destinatarioId === clienteId).map(x => x.tipo).sort();
    assert.deepEqual(tipos, ['SOLICITACAO_RECUSADA', 'SOLICITACAO_RESPONDIDA'].sort());

    const cancelado = await criarSolicitacao(clienteId, entrada());
    await cancelarComoCliente(clienteId, cancelado.id);
    const avisos = await prisma.notificacao.findMany({
      where: { solicitacaoId: cancelado.id, tipo: 'SOLICITACAO_CANCELADA' },
    });
    assert.equal(avisos.length, 1);
    assert.equal(avisos[0]?.destinatarioId, profissionalId);
  });

  it('duas decisões concorrentes só podem registrar uma mudança', async () => {
    const pedido = await criarSolicitacao(clienteId, entrada());
    const resultados = await Promise.allSettled([
      atualizarStatusComoProfissional(profissionalId, pedido.id, { status: 'ACEITA' }),
      atualizarStatusComoProfissional(profissionalId, pedido.id, { status: 'RECUSADA' }),
    ]);
    assert.equal(resultados.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(resultados.filter(x => x.status === 'rejected').length, 1);
    assert.equal(await prisma.notificacao.count({ where: { solicitacaoId: pedido.id, destinatarioId: clienteId } }), 1);
  });

  it('impede notificação com referência a outro usuário e reverte a operação', async () => {
    const antes = await pedidosCriados();
    await assert.rejects(prisma.$transaction(async tx => {
      const pedido = await tx.solicitacaoOrcamento.create({
        data: {
          clienteId, profissionalId, categoriaId, cep: '24900000',
          endereco: 'Endereço fictício de teste, 43', tamanhoM2: 15,
        },
      });
      await tx.notificacao.create({
        data: {
          destinatarioId: 'id-inexistente',
          solicitacaoId: pedido.id,
          tipo: 'NOVA_SOLICITACAO',
          titulo: 'Teste de falha',
          mensagem: 'A notificação não deve ser criada.',
        },
      });
    }));
    assert.equal(await pedidosCriados(), antes);
  });

  it('marcar todas como lidas afeta somente a conta autenticada', async () => {
    const antes = await prisma.notificacao.count({
      where: { destinatarioId: profissionalId, lidaEm: null },
    });
    assert.ok(antes > 0);
    const resposta = await app.inject({
      method: 'POST', url: '/api/notificacoes/marcar-todas',
      headers: { authorization: `Bearer ${profissionalToken}` },
    });
    assert.equal(resposta.statusCode, 200);
    assert.equal(await prisma.notificacao.count({
      where: { destinatarioId: profissionalId, lidaEm: null },
    }), 0);
    assert.ok(await prisma.notificacao.count({
      where: { destinatarioId: clienteId, lidaEm: null },
    }) > 0);
  });

  it('não permite leitura de notificações com token de conta bloqueada', async () => {
    await prisma.usuario.update({ where: { id: clienteId }, data: { ativo: false } });
    try {
      const resposta = await app.inject({
        method: 'GET', url: '/api/notificacoes',
        headers: { authorization: `Bearer ${clienteToken}` },
      });
      assert.equal(resposta.statusCode, 401);
    } finally {
      await prisma.usuario.update({ where: { id: clienteId }, data: { ativo: true } });
    }
  });

  it('protege a tabela de assinaturas push com RLS', async () => {
    const rows = await prisma.$queryRaw<Array<{ ativo: boolean }>>`
      SELECT c.relrowsecurity AS ativo FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='assinaturas_push'
    `;
    assert.equal(rows[0]?.ativo, true);
  });

  it('registra somente dispositivos autorizados e permite revogação por usuário', async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/ci-test-${suffix}`;
    const assinatura = {
      endpoint,
      keys: { p256dh: 'a'.repeat(80), auth: 'b'.repeat(22) },
    };
    const headers = { authorization: `Bearer ${profissionalToken}` };

    const semLogin = await app.inject({
      method: 'POST', url: '/api/push/assinaturas', payload: assinatura,
    });
    assert.equal(semLogin.statusCode, 401);

    const malicioso = await app.inject({
      method: 'POST', url: '/api/push/assinaturas', headers,
      payload: { ...assinatura, endpoint: 'http://localhost/private' },
    });
    assert.equal(malicioso.statusCode, 400);

    const verificarSemLogin = await app.inject({
      method: 'POST', url: '/api/push/assinaturas/verificar', payload: { endpoint },
    });
    assert.equal(verificarSemLogin.statusCode, 401);
    const verificarAntes = await app.inject({
      method: 'POST', url: '/api/push/assinaturas/verificar',
      headers, payload: { endpoint },
    });
    assert.equal(verificarAntes.statusCode, 200);
    assert.equal(verificarAntes.json().registrada, false);

    const ativar = await app.inject({
      method: 'POST', url: '/api/push/assinaturas', headers, payload: assinatura,
    });
    assert.equal(ativar.statusCode, 201);
    assert.equal(await prisma.assinaturaPush.count({
      where: { usuarioId: profissionalId, endpoint },
    }), 1);

    const verificarAtiva = await app.inject({
      method: 'POST', url: '/api/push/assinaturas/verificar',
      headers, payload: { endpoint },
    });
    assert.equal(verificarAtiva.statusCode, 200);
    assert.equal(verificarAtiva.json().registrada, true);
    assert.equal(verificarAtiva.headers['cache-control'], 'no-store');

    const verificarOutroUsuario = await app.inject({
      method: 'POST', url: '/api/push/assinaturas/verificar',
      headers: { authorization: `Bearer ${clienteToken}` }, payload: { endpoint },
    });
    assert.equal(verificarOutroUsuario.statusCode, 200);
    assert.equal(verificarOutroUsuario.json().registrada, false);

    const tentarApagarOutro = await app.inject({
      method: 'DELETE', url: '/api/push/assinaturas',
      headers: { authorization: `Bearer ${clienteToken}` },
      payload: { endpoint },
    });
    assert.equal(tentarApagarOutro.statusCode, 200);
    assert.equal(await prisma.assinaturaPush.count({ where: { endpoint } }), 1);

    const desativar = await app.inject({
      method: 'DELETE', url: '/api/push/assinaturas', headers,
      payload: { endpoint },
    });
    assert.equal(desativar.statusCode, 200);
    assert.equal(await prisma.assinaturaPush.count({ where: { endpoint } }), 0);

    const verificarDepois410 = await app.inject({
      method: 'POST', url: '/api/push/assinaturas/verificar',
      headers, payload: { endpoint },
    });
    assert.equal(verificarDepois410.statusCode, 200);
    assert.equal(verificarDepois410.json().registrada, false);
  });

  it('rejeita limites inválidos sem consultar dados de terceiros', async () => {
    const resposta = await app.inject({
      method: 'GET', url: '/api/notificacoes?limite=100000',
      headers: { authorization: `Bearer ${profissionalToken}` },
    });
    assert.equal(resposta.statusCode, 400);
  });
});
