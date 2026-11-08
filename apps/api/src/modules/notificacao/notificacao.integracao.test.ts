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
import { perfilRoutes } from '../perfil/perfil.routes.js';
import { avaliacaoRoutes } from '../avaliacao/avaliacao.routes.js';
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
    await app.register(perfilRoutes, { prefix: '/api' });
    await app.register(avaliacaoRoutes, { prefix: '/api' });
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

  it('API pública não revela CEP-base, coordenadas ou informações internas do prestador', async () => {
    const resposta = await app.inject({
      method: 'GET', url: `/api/profissionais/${profissionalId}`,
    });
    assert.equal(resposta.statusCode, 200);
    const perfil = resposta.json() as Record<string, any>;
    assert.equal(perfil.usuarioId, profissionalId);
    assert.equal(perfil.nomeExibicao, 'Profissional teste');
    assert.equal(perfil.cidade?.nome, 'Cidade teste');

    // Nenhuma informação que permita localizar o domicílio do prestador
    // nem campos financeiros/operacionais internos na API pública.
    for (const campo of ['cepBase', 'lat', 'lng', 'plano', 'perfilPublicado',
                         'atualizadoEm', 'usuario']) {
      assert.equal(Object.hasOwn(perfil, campo), false, `campo privado: ${campo}`);
    }
    for (const campo of ['lat', 'lng']) {
      assert.equal(Object.hasOwn(perfil.cidade, campo), false, `cidade privada: ${campo}`);
    }
    const privadoSemAutenticacao = await app.inject({
      method: 'GET', url: '/api/perfil/mim',
    });
    assert.equal(privadoSemAutenticacao.statusCode, 401);
    const privadoAutenticado = await app.inject({
      method: 'GET', url: '/api/perfil/mim',
      headers: { authorization: `Bearer ${profissionalToken}` },
    });
    assert.equal(privadoAutenticado.statusCode, 200);
    assert.equal(privadoAutenticado.json().cepBase, '24900000');

    await prisma.perfilProfissional.update({
      where: { usuarioId: profissionalId },
      data: { perfilPublicado: false },
    });
    try {
      const despublicado = await app.inject({
        method: 'GET', url: `/api/profissionais/${profissionalId}`,
      });
      assert.equal(despublicado.statusCode, 404);
    } finally {
      await prisma.perfilProfissional.update({
        where: { usuarioId: profissionalId },
        data: { perfilPublicado: true },
      });
    }
  });

  it('avaliações públicas desaparecem se perfil é despublicado ou conta inativada', async () => {
    const pedido = await prisma.solicitacaoOrcamento.create({
      data: {
        clienteId, profissionalId, categoriaId, cep: '24900000',
        endereco: 'Pedido de avaliação reservado ao CI',
        tamanhoM2: 10, status: 'CONCLUIDA',
      },
    });
    try {
      await prisma.avaliacao.create({
        data: {
          solicitacaoId: pedido.id, avaliadorId: clienteId,
          avaliadoId: profissionalId, tipo: 'CLIENTE_AVALIA_PROFISSIONAL',
          nota: 5, comentario: 'Avaliação do banco descartável',
        },
      });
      const caminho = `/api/profissionais/${profissionalId}/avaliacoes`;
      const publico = await app.inject({ method: 'GET', url: caminho });
      assert.equal(publico.statusCode, 200);
      assert.ok((publico.json() as { id: string }[]).length > 0);

      await prisma.perfilProfissional.update({
        where: { usuarioId: profissionalId }, data: { perfilPublicado: false },
      });
      const oculto = await app.inject({ method: 'GET', url: caminho });
      assert.deepEqual(oculto.json(), []);
      await prisma.perfilProfissional.update({
        where: { usuarioId: profissionalId }, data: { perfilPublicado: true },
      });

      await prisma.usuario.update({ where: { id: profissionalId }, data: { ativo: false } });
      const bloqueado = await app.inject({ method: 'GET', url: caminho });
      assert.deepEqual(bloqueado.json(), []);
    } finally {
      await prisma.usuario.update({ where: { id: profissionalId }, data: { ativo: true } });
      await prisma.perfilProfissional.update({
        where: { usuarioId: profissionalId }, data: { perfilPublicado: true },
      });
      await prisma.avaliacao.deleteMany({ where: { solicitacaoId: pedido.id } });
      await prisma.solicitacaoOrcamento.delete({ where: { id: pedido.id } });
    }
  });

  it('limita criação abusiva de solicitações por cliente sem gerar pedido ou Push', async () => {
    const chave = `limite:solicitacoes:${clienteId}`;
    const antes = await prisma.solicitacaoOrcamento.count({ where: { clienteId } });
    await redis.set(chave, '12', 'EX', 900);
    try {
      const resposta = await app.inject({
        method: 'POST', url: '/api/solicitacoes',
        headers: { authorization: `Bearer ${clienteToken}` },
        payload: entrada(),
      });
      assert.equal(resposta.statusCode, 429);
      assert.equal(await prisma.solicitacaoOrcamento.count({ where: { clienteId } }), antes);
    } finally {
      await redis.del(chave);
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

  it('reenvio após timeout mantém o mesmo pedido e uma única notificação', async () => {
    const chave = randomUUID();
    const chaveLimite = `limite:solicitacoes:${clienteId}`;
    const contagemAntes = Number(await redis.get(chaveLimite) ?? '0');
    const antes = await pedidosCriados();
    const totalAvisos = await prisma.notificacao.count({ where: { destinatarioId: profissionalId } });
    const headers = { authorization: `Bearer ${clienteToken}`, 'idempotency-key': chave };
    const primeira = await app.inject({
      method: 'POST', url: '/api/solicitacoes', headers, payload: entrada(),
    });
    assert.equal(primeira.statusCode, 201, primeira.body);
    const reenvio = await app.inject({
      method: 'POST', url: '/api/solicitacoes', headers, payload: entrada(),
    });
    assert.equal(reenvio.statusCode, 200, reenvio.body);
    assert.equal(primeira.json().id, reenvio.json().id);
    assert.equal(primeira.json().linkWhatsapp, reenvio.json().linkWhatsapp);
    assert.equal(Object.hasOwn(primeira.json(), 'idempotencyKey'), false);
    assert.equal(Object.hasOwn(reenvio.json(), 'idempotencyHash'), false);
    assert.equal(await pedidosCriados(), antes + 1);
    assert.equal(await prisma.notificacao.count({ where: { destinatarioId: profissionalId } }), totalAvisos + 1);
    assert.equal(Number(await redis.get(chaveLimite)), contagemAntes + 1, 'retry não consome cota novamente');

    const payloadDiferente = { ...entrada(), endereco: 'Outro endereco de teste, 100' };
    const conflito = await app.inject({
      method: 'POST', url: '/api/solicitacoes', headers, payload: payloadDiferente,
    });
    assert.equal(conflito.statusCode, 409);
    assert.equal(await pedidosCriados(), antes + 1);

    const malformada = await app.inject({
      method: 'POST', url: '/api/solicitacoes',
      headers: { authorization: `Bearer ${clienteToken}`, 'idempotency-key': 'nao-e-uuid' },
      payload: entrada(),
    });
    assert.equal(malformada.statusCode, 400);

    // Mesmo com a cota do cliente esgotada, a API deve recuperar o pedido
    // original, não devolver 429 nem tentar criar outro.
    await redis.set(chaveLimite, '12', 'EX', 900);
    try {
      const recuperado = await app.inject({
        method: 'POST', url: '/api/solicitacoes', headers, payload: entrada(),
      });
      assert.equal(recuperado.statusCode, 200, recuperado.body);
      assert.equal(recuperado.json().id, primeira.json().id);
    } finally {
      await redis.del(chaveLimite);
    }
  });

  it('duas requisições concorrentes da mesma tentativa criam só um pedido e Push', async () => {
    const chave = randomUUID();
    const headers = { authorization: `Bearer ${clienteToken}`, 'idempotency-key': chave };
    const antes = await pedidosCriados();
    const avisosAntes = await prisma.notificacao.count({ where: { destinatarioId: profissionalId } });
    const respostas = await Promise.all([
      app.inject({ method: 'POST', url: '/api/solicitacoes', headers, payload: entrada() }),
      app.inject({ method: 'POST', url: '/api/solicitacoes', headers, payload: entrada() }),
    ]);
    assert.ok(respostas.every(r => [200, 201].includes(r.statusCode)),
      JSON.stringify(respostas.map(r => [r.statusCode, r.body])));
    assert.equal(respostas[0].json().id, respostas[1].json().id);
    assert.equal(await pedidosCriados(), antes + 1);
    assert.equal(await prisma.notificacao.count({ where: { destinatarioId: profissionalId } }), avisosAntes + 1);
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

  it('organiza pedidos do prestador por grupo e pagina sem perder o histórico', async () => {
    const marcacao = `teste-grupos-${suffix}`;
    const statuses = [
      'PENDENTE', 'PENDENTE', 'PENDENTE', 'PENDENTE',
      'PENDENTE', 'PENDENTE', 'PENDENTE', 'PENDENTE',
      'RESPONDIDA', 'ACEITA', 'RECUSADA', 'CONCLUIDA', 'CANCELADA',
    ] as const;
    await prisma.solicitacaoOrcamento.createMany({
      data: statuses.map((status, n) => ({
        clienteId, profissionalId, categoriaId,
        cep: '24900000', endereco: `Endereco de testes ${n}, Marica`,
        tamanhoM2: 20, descricao: marcacao, status,
      })),
    });
    const headers = { authorization: `Bearer ${profissionalToken}` };
    try {
      const novos = await app.inject({
        method: 'GET',
        url: '/api/solicitacoes/recebidas?grupo=NOVOS&pagina=1&porPagina=5',
        headers,
      });
      assert.equal(novos.statusCode, 200);
      const dadosNovos = novos.json() as { total: number; itens: { id: string; status: string }[] };
      assert.ok(dadosNovos.total >= 8);
      assert.equal(dadosNovos.itens.length, 5);
      assert.ok(dadosNovos.itens.every(x => x.status === 'PENDENTE'));

      const seguintes = await app.inject({
        method: 'GET',
        url: '/api/solicitacoes/recebidas?grupo=NOVOS&pagina=2&porPagina=5',
        headers,
      });
      assert.equal(seguintes.statusCode, 200);
      const dadosSeguintes = seguintes.json() as { itens: { id: string; status: string }[] };
      assert.ok(dadosSeguintes.itens.length > 0);
      assert.ok(dadosSeguintes.itens.every(x => x.status === 'PENDENTE'));
      assert.ok(dadosSeguintes.itens.every(x => !dadosNovos.itens.some(y => y.id === x.id)));

      const andamento = await app.inject({
        method: 'GET',
        url: '/api/solicitacoes/recebidas?grupo=EM_ANDAMENTO&porPagina=5',
        headers,
      });
      assert.equal(andamento.statusCode, 200);
      const dadosAndamento = andamento.json() as { itens: { status: string }[] };
      assert.ok(dadosAndamento.itens.some(x => x.status === 'RESPONDIDA'));
      assert.ok(dadosAndamento.itens.some(x => x.status === 'ACEITA'));
      assert.ok(dadosAndamento.itens.every(x => ['RESPONDIDA', 'ACEITA'].includes(x.status)));

      const historico = await app.inject({
        method: 'GET',
        url: '/api/solicitacoes/recebidas?grupo=HISTORICO&porPagina=5',
        headers,
      });
      assert.equal(historico.statusCode, 200);
      assert.ok((historico.json() as { itens: { status: string }[] }).itens.every(
        x => ['RECUSADA', 'CONCLUIDA', 'CANCELADA'].includes(x.status)
      ));

      const doisFiltros = await app.inject({
        method: 'GET',
        url: '/api/solicitacoes/recebidas?grupo=NOVOS&status=CONCLUIDA',
        headers,
      });
      assert.equal(doisFiltros.statusCode, 400);
      const acessoCliente = await app.inject({
        method: 'GET', url: '/api/solicitacoes/recebidas?grupo=NOVOS',
        headers: { authorization: `Bearer ${clienteToken}` },
      });
      assert.equal(acessoCliente.statusCode, 403);
    } finally {
      await prisma.solicitacaoOrcamento.deleteMany({
        where: { clienteId, profissionalId, descricao: marcacao },
      });
    }
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
