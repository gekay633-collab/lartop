import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { ListarResultadosPrestadoresQuery } from './admin.schemas.js';

// Resumo somente de leitura. Nunca modifica perfis, pedidos ou avaliações.
export async function listarResultadosPrestadores(query: ListarResultadosPrestadoresQuery) {
  const inicio = query.periodo === '30d'
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null;

  const where: Prisma.PerfilProfissionalWhereInput = query.busca ? {
    OR: [
      { nomeExibicao: { contains: query.busca, mode: 'insensitive' } },
      { usuario: { email: { contains: query.busca, mode: 'insensitive' } } },
    ],
  } : {};

  const [total, prestadores] = await Promise.all([
    prisma.perfilProfissional.count({ where }),
    prisma.perfilProfissional.findMany({
      where,
      orderBy: [{ criadoEm: 'desc' }, { usuarioId: 'asc' }],
      skip: (query.pagina - 1) * query.porPagina,
      take: query.porPagina,
      select: {
        usuarioId: true,
        nomeExibicao: true,
        perfilPublicado: true,
        notaMedia: true,
        totalAvaliacoes: true,
        usuario: { select: { ativo: true } },
        cidade: { select: { nome: true, estado: true } },
      },
    }),
  ]);
  const ids = prestadores.map((p) => p.usuarioId);
  if (ids.length === 0) return { total, pagina: query.pagina, porPagina: query.porPagina, periodo: query.periodo, itens: [] };

  // Pedidos agrupados por prestador e status: não buscar nomes, telefones,
  // tokens, endereços ou qualquer informação dos clientes.
  const wherePedidos: Prisma.SolicitacaoOrcamentoWhereInput = {
    profissionalId: { in: ids },
    ...(inicio ? { criadoEm: { gte: inicio } } : {}),
  };
  const whereAvaliacao = inicio ? { criadoEm: { gte: inicio } } : {};

  const [pedidos, visitantes, avisos, avaliacoesCadastradas, avaliacoesVisitantes] = await Promise.all([
    prisma.solicitacaoOrcamento.groupBy({
      by: ['profissionalId', 'status'],
      where: wherePedidos,
      _count: { _all: true },
    }),
    prisma.solicitacaoOrcamento.groupBy({
      by: ['profissionalId'],
      where: { ...wherePedidos, clienteId: null },
      _count: { _all: true },
    }),
    prisma.notificacao.groupBy({
      by: ['destinatarioId'],
      where: {
        destinatarioId: { in: ids },
        tipo: 'NOVA_SOLICITACAO',
        ...(inicio ? { criadoEm: { gte: inicio } } : {}),
      },
      _count: { _all: true },
    }),
    prisma.avaliacao.groupBy({
      by: ['avaliadoId'],
      where: {
        avaliadoId: { in: ids },
        tipo: 'CLIENTE_AVALIA_PROFISSIONAL',
        ...whereAvaliacao,
      },
      _count: { _all: true },
    }),
    // JOIN parametrizado: Prisma não permite groupBy por campo da relação.
    // Somente ids conhecidos da página; saída contém contagens, jamais PII.
    prisma.$queryRaw<Array<{ profissionalId: string; total: bigint }>>(Prisma.sql`
      SELECT s.profissional_id AS "profissionalId", COUNT(v.id)::bigint AS "total"
      FROM public.avaliacoes_visitantes v
      INNER JOIN public.solicitacoes_orcamento s ON s.id = v.solicitacao_id
      WHERE s.profissional_id IN (${Prisma.join(ids)})
      ${inicio ? Prisma.sql`AND v.criado_em >= ${inicio}` : Prisma.empty}
      GROUP BY s.profissional_id
    `),
  ]);

  const porId = new Map(ids.map((id) => [id, {
    recebidos: 0,
    pendentes: 0,
    respondidosOuAceitos: 0,
    aceitosOuConcluidos: 0,
    concluidosInformados: 0,
    recusados: 0,
    cancelados: 0,
    semCadastro: 0,
    avisosRegistrados: 0,
    avaliacoes: 0,
    feedbacksVisitantes: 0,
  }]));

  for (const linha of pedidos) {
    const m = porId.get(linha.profissionalId)!;
    const n = linha._count._all;
    m.recebidos += n;
    if (linha.status === 'PENDENTE') m.pendentes += n;
    if (['RESPONDIDA', 'ACEITA', 'CONCLUIDA'].includes(linha.status)) m.respondidosOuAceitos += n;
    if (['ACEITA', 'CONCLUIDA'].includes(linha.status)) m.aceitosOuConcluidos += n;
    if (linha.status === 'CONCLUIDA') m.concluidosInformados += n;
    if (linha.status === 'RECUSADA') m.recusados += n;
    if (linha.status === 'CANCELADA') m.cancelados += n;
  }
  for (const linha of visitantes) porId.get(linha.profissionalId)!.semCadastro = linha._count._all;
  for (const linha of avisos) porId.get(linha.destinatarioId)!.avisosRegistrados = linha._count._all;
  for (const linha of avaliacoesCadastradas) porId.get(linha.avaliadoId)!.avaliacoes += linha._count._all;
  for (const linha of avaliacoesVisitantes) {
    const m = porId.get(linha.profissionalId)!;
    const n = Number(linha.total);
    m.feedbacksVisitantes = n;
    m.avaliacoes += n;
  }

  return {
    total, pagina: query.pagina, porPagina: query.porPagina, periodo: query.periodo,
    itens: prestadores.map((p) => ({
      usuarioId: p.usuarioId,
      nomeExibicao: p.nomeExibicao,
      perfilPublicado: p.perfilPublicado,
      contaAtiva: p.usuario.ativo,
      cidade: p.cidade,
      // Nota geral do perfil, não apenas do período escolhido.
      notaMediaGeral: p.notaMedia,
      totalAvaliacoesGeral: p.totalAvaliacoes,
      metricas: porId.get(p.usuarioId)!,
    })),
  };
}
