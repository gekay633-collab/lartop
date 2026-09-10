import { prisma } from '../../lib/prisma.js';
import { gerarLinkWhatsapp } from '../../lib/whatsapp.js';
import { registrarEvento } from '../evento/evento.service.js';
import type {
  CriarSolicitacaoInput,
  AtualizarStatusInput,
  ListarSolicitacoesQuery,
} from './solicitacao.schemas.js';

class SolicitacaoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const TRANSICOES_PROFISSIONAL: Record<string, string[]> = {
  PENDENTE: ['RESPONDIDA', 'ACEITA', 'RECUSADA'],
  RESPONDIDA: ['ACEITA', 'RECUSADA'],
  ACEITA: ['CONCLUIDA'],
};

const TRANSICOES_CLIENTE: Record<string, string[]> = {
  PENDENTE: ['CANCELADA'],
  RESPONDIDA: ['CANCELADA'],
};

export async function criarSolicitacao(clienteId: string, input: CriarSolicitacaoInput) {
  const profissional = await prisma.perfilProfissional.findUnique({
    where: { usuarioId: input.profissionalId },
    include: { usuario: { select: { telefone: true } } },
  });

  if (!profissional || !profissional.perfilPublicado) {
    throw new SolicitacaoError('Profissional nao encontrado ou perfil nao publicado', 404);
  }

  if (!profissional.usuario.telefone) {
    throw new SolicitacaoError('Profissional sem telefone cadastrado', 400);
  }

  const categoriaValida = await prisma.profissionalCategoria.findFirst({
    where: { profissionalId: input.profissionalId, categoriaId: input.categoriaId },
    include: { categoria: true },
  });

  if (!categoriaValida) {
    throw new SolicitacaoError('Esse profissional nao atende essa categoria', 400);
  }

  const solicitacao = await prisma.solicitacaoOrcamento.create({
    data: {
      clienteId,
      profissionalId: input.profissionalId,
      categoriaId: input.categoriaId,
      cep: input.cep,
      endereco: input.endereco,
      tamanhoM2: input.tamanhoM2,
      descricao: input.descricao,
      fotos: input.fotos,
    },
    include: { categoria: true, profissional: { select: { nomeExibicao: true, cidadeId: true } } },
  });

  const linkWhatsapp = gerarLinkWhatsapp(profissional.usuario.telefone, {
    categoriaNome: categoriaValida.categoria.nome,
    endereco: input.endereco,
    tamanhoM2: input.tamanhoM2,
    descricao: input.descricao,
  });

  registrarEvento({
    tipo: 'CONTATO_GERADO',
    cidadeId: solicitacao.profissional.cidadeId,
    categoriaId: input.categoriaId,
    profissionalId: input.profissionalId,
  });

  return { ...solicitacao, linkWhatsapp };
}

export async function listarSolicitacoesRecebidas(
  profissionalId: string,
  query: ListarSolicitacoesQuery
) {
  const where = {
    profissionalId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, itens] = await Promise.all([
    prisma.solicitacaoOrcamento.count({ where }),
    prisma.solicitacaoOrcamento.findMany({
      where,
      include: {
        categoria: true,
        cliente: { select: { id: true, nome: true, telefone: true, telefoneVerificado: true } },
      },
      orderBy: { criadoEm: 'desc' },
      skip: (query.pagina - 1) * query.porPagina,
      take: query.porPagina,
    }),
  ]);

  return { total, pagina: query.pagina, porPagina: query.porPagina, itens };
}

export async function listarMinhasSolicitacoes(clienteId: string, query: ListarSolicitacoesQuery) {
  const where = {
    clienteId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, itens] = await Promise.all([
    prisma.solicitacaoOrcamento.count({ where }),
    prisma.solicitacaoOrcamento.findMany({
      where,
      include: {
        categoria: true,
        profissional: { select: { nomeExibicao: true, fotoPerfilUrl: true } },
        avaliacoes: { where: { avaliadorId: clienteId }, select: { id: true } },
      },
      orderBy: { criadoEm: 'desc' },
      skip: (query.pagina - 1) * query.porPagina,
      take: query.porPagina,
    }),
  ]);

  const itensComFlag = itens.map((item) => ({
    ...item,
    jaAvaliada: item.avaliacoes.length > 0,
    avaliacoes: undefined,
  }));

  return { total, pagina: query.pagina, porPagina: query.porPagina, itens: itensComFlag };
}

export async function atualizarStatusComoProfissional(
  profissionalId: string,
  solicitacaoId: string,
  input: AtualizarStatusInput
) {
  const solicitacao = await prisma.solicitacaoOrcamento.findUnique({ where: { id: solicitacaoId } });

  if (!solicitacao || solicitacao.profissionalId !== profissionalId) {
    throw new SolicitacaoError('Solicitacao nao encontrada', 404);
  }

  const permitidas = TRANSICOES_PROFISSIONAL[solicitacao.status] ?? [];
  if (!permitidas.includes(input.status)) {
    throw new SolicitacaoError(
      `Nao e possivel mudar de ${solicitacao.status} para ${input.status}`,
      400
    );
  }

  return prisma.solicitacaoOrcamento.update({
    where: { id: solicitacaoId },
    data: { status: input.status },
  });
}

export async function cancelarComoCliente(clienteId: string, solicitacaoId: string) {
  const solicitacao = await prisma.solicitacaoOrcamento.findUnique({ where: { id: solicitacaoId } });

  if (!solicitacao || solicitacao.clienteId !== clienteId) {
    throw new SolicitacaoError('Solicitacao nao encontrada', 404);
  }

  const permitidas = TRANSICOES_CLIENTE[solicitacao.status] ?? [];
  if (!permitidas.includes('CANCELADA')) {
    throw new SolicitacaoError(`Nao e possivel cancelar uma solicitacao ${solicitacao.status}`, 400);
  }

  return prisma.solicitacaoOrcamento.update({
    where: { id: solicitacaoId },
    data: { status: 'CANCELADA' },
  });
}

export { SolicitacaoError };
