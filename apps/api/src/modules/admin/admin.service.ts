import { prisma } from '../../lib/prisma.js';
import type {
  ListarPrestadoresQuery,
  ListarClientesQuery,
  CriarCategoriaInput,
  AtualizarCategoriaInput,
} from './admin.schemas.js';

class AdminError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function obterDashboard() {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const [
    totalClientes,
    totalPrestadores,
    prestadoresPublicados,
    prestadoresNaoPublicados,
    novosClientesHoje,
    novosPrestadoresHoje,
    solicitacoesHoje,
    solicitacoesTotal,
    avaliacoesTotal,
  ] = await Promise.all([
    prisma.usuario.count({ where: { tipo: 'CLIENTE' } }),
    prisma.usuario.count({ where: { tipo: 'PROFISSIONAL' } }),
    prisma.perfilProfissional.count({ where: { perfilPublicado: true } }),
    prisma.perfilProfissional.count({ where: { perfilPublicado: false } }),
    prisma.usuario.count({ where: { tipo: 'CLIENTE', criadoEm: { gte: inicioHoje } } }),
    prisma.usuario.count({ where: { tipo: 'PROFISSIONAL', criadoEm: { gte: inicioHoje } } }),
    prisma.solicitacaoOrcamento.count({ where: { criadoEm: { gte: inicioHoje } } }),
    prisma.solicitacaoOrcamento.count(),
    prisma.avaliacao.count(),
  ]);

  const usuariosBloqueados = await prisma.usuario.count({ where: { ativo: false } });

  return {
    hoje: {
      novosClientes: novosClientesHoje,
      novosPrestadores: novosPrestadoresHoje,
      solicitacoes: solicitacoesHoje,
    },
    geral: {
      totalClientes,
      totalPrestadores,
      prestadoresPublicados,
      prestadoresNaoPublicados,
      solicitacoesTotal,
      avaliacoesTotal,
      usuariosBloqueados,
    },
  };
}

export async function listarPrestadores(query: ListarPrestadoresQuery) {
  const where: any = {};

  if (query.busca) {
    where.OR = [
      { nomeExibicao: { contains: query.busca, mode: 'insensitive' } },
      { usuario: { email: { contains: query.busca, mode: 'insensitive' } } },
    ];
  }

  if (query.status === 'publicado') where.perfilPublicado = true;
  if (query.status === 'nao_publicado') where.perfilPublicado = false;

  const [total, itens] = await Promise.all([
    prisma.perfilProfissional.count({ where }),
    prisma.perfilProfissional.findMany({
      where,
      include: {
        usuario: { select: { id: true, email: true, telefone: true, ativo: true, criadoEm: true } },
        cidade: { select: { nome: true, estado: true } },
        _count: { select: { fotos: true, categorias: true } },
      },
      orderBy: { criadoEm: 'desc' },
      skip: (query.pagina - 1) * query.porPagina,
      take: query.porPagina,
    }),
  ]);

  return { total, pagina: query.pagina, porPagina: query.porPagina, itens };
}

export async function listarClientes(query: ListarClientesQuery) {
  const where: any = { tipo: 'CLIENTE' };

  if (query.busca) {
    where.OR = [
      { nome: { contains: query.busca, mode: 'insensitive' } },
      { email: { contains: query.busca, mode: 'insensitive' } },
    ];
  }

  const [total, itens] = await Promise.all([
    prisma.usuario.count({ where }),
    prisma.usuario.findMany({
      where,
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        ativo: true,
        criadoEm: true,
        _count: { select: { solicitacoesFeitas: true } },
      },
      orderBy: { criadoEm: 'desc' },
      skip: (query.pagina - 1) * query.porPagina,
      take: query.porPagina,
    }),
  ]);

  return { total, pagina: query.pagina, porPagina: query.porPagina, itens };
}

export async function alternarBloqueioUsuario(usuarioId: string, ativo: boolean) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) {
    throw new AdminError('Usuario nao encontrado', 404);
  }

  if (usuario.tipo === 'ADMIN') {
    throw new AdminError('Nao e possivel bloquear uma conta de administrador', 400);
  }

  return prisma.usuario.update({
    where: { id: usuarioId },
    data: { ativo },
    select: { id: true, nome: true, email: true, tipo: true, ativo: true },
  });
}

export async function listarCategoriasAdmin() {
  return prisma.categoria.findMany({
    orderBy: { nome: 'asc' },
    include: { _count: { select: { profissionais: true } } },
  });
}

export async function criarCategoria(input: CriarCategoriaInput) {
  const existente = await prisma.categoria.findUnique({ where: { slug: input.slug } });
  if (existente) {
    throw new AdminError('Ja existe uma categoria com esse slug', 409);
  }

  return prisma.categoria.create({ data: input });
}

export async function atualizarCategoria(id: string, input: AtualizarCategoriaInput) {
  const existente = await prisma.categoria.findUnique({ where: { id } });
  if (!existente) {
    throw new AdminError('Categoria nao encontrada', 404);
  }

  return prisma.categoria.update({ where: { id }, data: input });
}

export { AdminError };

export async function alternarPublicacaoPrestador(usuarioId: string, publicado: boolean) {
  const perfil = await prisma.perfilProfissional.findUnique({ where: { usuarioId } });
  if (!perfil) {
    throw new AdminError('Prestador nao encontrado', 404);
  }

  return prisma.perfilProfissional.update({
    where: { usuarioId },
    data: { perfilPublicado: publicado },
  });
}

export async function obterOfertaDemanda() {
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  const pesquisas = await prisma.eventoAnalytics.groupBy({
    by: ['cidadeId', 'categoriaId'],
    where: { tipo: 'PESQUISA', criadoEm: { gte: trintaDiasAtras }, cidadeId: { not: null }, categoriaId: { not: null } },
    _count: { id: true },
  });

  const contatos = await prisma.eventoAnalytics.groupBy({
    by: ['cidadeId', 'categoriaId'],
    where: { tipo: 'CONTATO_GERADO', criadoEm: { gte: trintaDiasAtras }, cidadeId: { not: null }, categoriaId: { not: null } },
    _count: { id: true },
  });

  const chaves = new Set<string>();
  pesquisas.forEach((p) => chaves.add(`${p.cidadeId}::${p.categoriaId}`));
  contatos.forEach((c) => chaves.add(`${c.cidadeId}::${c.categoriaId}`));

  if (chaves.size === 0) {
    return [];
  }

  const cidadeIds = [...new Set([...chaves].map((k) => k.split('::')[0]))];
  const categoriaIds = [...new Set([...chaves].map((k) => k.split('::')[1]))];

  const [cidades, categorias, prestadoresPorCidadeCategoria] = await Promise.all([
    prisma.cidade.findMany({ where: { id: { in: cidadeIds } }, select: { id: true, nome: true, estado: true } }),
    prisma.categoria.findMany({ where: { id: { in: categoriaIds } }, select: { id: true, nome: true } }),
    prisma.profissionalCategoria.findMany({
      where: { categoriaId: { in: categoriaIds }, profissional: { cidadeId: { in: cidadeIds }, perfilPublicado: true } },
      select: { categoriaId: true, profissional: { select: { cidadeId: true } } },
    }),
  ]);

  const mapaCidades = new Map(cidades.map((c) => [c.id, c]));
  const mapaCategorias = new Map(categorias.map((c) => [c.id, c]));

  const mapaPrestadores = new Map<string, number>();
  prestadoresPorCidadeCategoria.forEach((pc) => {
    const chave = `${pc.profissional.cidadeId}::${pc.categoriaId}`;
    mapaPrestadores.set(chave, (mapaPrestadores.get(chave) ?? 0) + 1);
  });

  const mapaPesquisas = new Map(pesquisas.map((p) => [`${p.cidadeId}::${p.categoriaId}`, p._count.id]));
  const mapaContatos = new Map(contatos.map((c) => [`${c.cidadeId}::${c.categoriaId}`, c._count.id]));

  const linhas = [...chaves].map((chave) => {
    const [cidadeId, categoriaId] = chave.split('::');
    const cidade = mapaCidades.get(cidadeId);
    const categoria = mapaCategorias.get(categoriaId);
    const totalPesquisas = mapaPesquisas.get(chave) ?? 0;
    const totalContatos = mapaContatos.get(chave) ?? 0;
    const totalPrestadores = mapaPrestadores.get(chave) ?? 0;

    let situacao: 'boa' | 'muita_oferta' | 'faltam_prestadores' = 'boa';
    if (totalPrestadores === 0 && totalPesquisas > 0) {
      situacao = 'faltam_prestadores';
    } else if (totalPrestadores > 0) {
      const pesquisasPorPrestador = totalPesquisas / totalPrestadores;
      if (pesquisasPorPrestador < 5) situacao = 'muita_oferta';
      else if (pesquisasPorPrestador > 20) situacao = 'faltam_prestadores';
    }

    return {
      cidade: cidade ? { id: cidade.id, nome: cidade.nome, estado: cidade.estado } : null,
      categoria: categoria ? { id: categoria.id, nome: categoria.nome } : null,
      totalPesquisas,
      totalPrestadores,
      totalContatos,
      situacao,
    };
  });

  return linhas.sort((a, b) => b.totalPesquisas - a.totalPesquisas);
}

export async function obterMetricasProfissional(usuarioId: string) {
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  const [visualizacoes, contatos] = await Promise.all([
    prisma.eventoAnalytics.count({
      where: { tipo: 'VISUALIZACAO_PERFIL', profissionalId: usuarioId, criadoEm: { gte: trintaDiasAtras } },
    }),
    prisma.eventoAnalytics.count({
      where: { tipo: 'CONTATO_GERADO', profissionalId: usuarioId, criadoEm: { gte: trintaDiasAtras } },
    }),
  ]);

  return { visualizacoes30dias: visualizacoes, contatos30dias: contatos };
}
