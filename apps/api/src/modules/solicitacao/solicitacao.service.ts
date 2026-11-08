import { prisma } from '../../lib/prisma.js';
import type { Prisma, StatusSolicitacao } from '@prisma/client';
import { gerarLinkWhatsapp } from '../../lib/whatsapp.js';
import { chaveDePedido, hashDePedido } from './solicitacao.idempotencia.js';
import { registrarEvento } from '../evento/evento.service.js';
import { AVISOS_CLIENTE } from '../notificacao/notificacao.eventos.js';
import { enviarPushNotificacao } from '../push/push.service.js';
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

const incluirDadosPedido = {
  categoria: true,
  profissional: { select: { nomeExibicao: true, cidadeId: true } },
} as const;

function respostaPedido<T extends {
  idempotencyKey: string | null;
  idempotencyHash: string | null;
  categoria: { nome: string };
  endereco: string;
  tamanhoM2: number;
  descricao: string | null;
}>(pedido: T, telefone: string) {
  // Nunca expor chaves/hashes internos em respostas de API.
  const { idempotencyKey: _chave, idempotencyHash: _hash, ...publico } = pedido;
  const linkWhatsapp = gerarLinkWhatsapp(telefone, {
    categoriaNome: pedido.categoria.nome,
    endereco: pedido.endereco,
    tamanhoM2: pedido.tamanhoM2,
    descricao: pedido.descricao ?? undefined,
  });
  return { ...publico, linkWhatsapp };
}

/**
 * Reenvio seguro, inclusive depois de um timeout no navegador.
 * Usa chave derivada da conta; nunca permite recuperar pedidos alheios.
 */
export async function consultarPedidoReenviado(
  clienteId: string, input: CriarSolicitacaoInput, chave: string,
) {
  const idempotencyKey = chaveDePedido(clienteId, chave);
  const anterior = await prisma.solicitacaoOrcamento.findUnique({
    where: { idempotencyKey },
    include: incluirDadosPedido,
  });
  if (!anterior) return null;
  if (anterior.clienteId !== clienteId || anterior.idempotencyHash !== hashDePedido(input)) {
    throw new SolicitacaoError('Esta tentativa já foi usada para um pedido diferente.', 409);
  }
  const usuario = await prisma.usuario.findUnique({
    where: { id: anterior.profissionalId },
    select: { telefone: true },
  });
  if (!usuario?.telefone) {
    throw new SolicitacaoError('Pedido localizado, mas o contato do profissional está indisponível.', 409);
  }
  return respostaPedido(anterior, usuario.telefone);
}

export async function criarSolicitacao(
  clienteId: string, input: CriarSolicitacaoInput, chave?: string,
) {
  // Primeiro recupera uma tentativa já concluída, mesmo que o perfil tenha
  // sido despublicado desde então. Replay não gera novo aviso ou evento.
  if (chave) {
    const anterior = await consultarPedidoReenviado(clienteId, input, chave);
    if (anterior) return anterior;
  }

  if (clienteId === input.profissionalId) {
    throw new SolicitacaoError('Não é permitido solicitar orçamento para o próprio perfil.', 403);
  }

  const profissional = await prisma.perfilProfissional.findUnique({
    where: { usuarioId: input.profissionalId },
    include: { usuario: { select: { telefone: true, ativo: true } } },
  });

  if (!profissional || !profissional.perfilPublicado || !profissional.usuario.ativo) {
    throw new SolicitacaoError('Profissional não encontrado ou perfil não publicado', 404);
  }
  if (!profissional.usuario.telefone) {
    throw new SolicitacaoError('Profissional sem telefone cadastrado', 400);
  }

  const categoriaValida = await prisma.profissionalCategoria.findFirst({
    where: { profissionalId: input.profissionalId, categoriaId: input.categoriaId },
    include: { categoria: true },
  });
  if (!categoriaValida) {
    throw new SolicitacaoError('Esse profissional não atende essa categoria', 400);
  }

  let resultado;
  try {
    resultado = await prisma.$transaction(async (tx) => {
      const pedido = await tx.solicitacaoOrcamento.create({
        data: {
          clienteId,
          profissionalId: input.profissionalId,
          categoriaId: input.categoriaId,
          cep: input.cep,
          endereco: input.endereco,
          tamanhoM2: input.tamanhoM2,
          descricao: input.descricao,
          fotos: input.fotos,
          idempotencyKey: chave ? chaveDePedido(clienteId, chave) : null,
          idempotencyHash: chave ? hashDePedido(input) : null,
        },
        include: incluirDadosPedido,
      });
      const avisoPush = await tx.notificacao.create({
        data: {
          destinatarioId: input.profissionalId,
          solicitacaoId: pedido.id,
          tipo: 'NOVA_SOLICITACAO',
          titulo: 'Você recebeu um novo pedido',
          mensagem: `Você recebeu uma solicitação de ${categoriaValida.categoria.nome}. Acesse seu painel para responder.`,
        },
      });
      return { solicitacao: pedido, avisoPush };
    });
  } catch (erro) {
    // Corrida entre múltiplas requisições: o índice único garante um único
    // commit. A requisição perdedora recupera o pedido vencedor sem novo Push.
    if (chave && erro && typeof erro === 'object' &&
        'code' in erro && erro.code === 'P2002') {
      const anterior = await consultarPedidoReenviado(clienteId, input, chave);
      if (anterior) return anterior;
    }
    throw erro;
  }

  await enviarPushNotificacao(input.profissionalId, resultado.avisoPush).catch((erro) => {
    console.error('[push] falha após criação de solicitação', erro instanceof Error ? erro.name : 'desconhecida');
  });

  registrarEvento({
    tipo: 'CONTATO_GERADO',
    cidadeId: resultado.solicitacao.profissional.cidadeId,
    categoriaId: input.categoriaId,
    profissionalId: input.profissionalId,
  });

  return respostaPedido(resultado.solicitacao, profissional.usuario.telefone);
}

export async function listarSolicitacoesRecebidas(
  profissionalId: string,
  query: ListarSolicitacoesQuery
) {
  const grupos: Record<'NOVOS' | 'EM_ANDAMENTO' | 'HISTORICO', StatusSolicitacao[]> = {
    NOVOS: ['PENDENTE'],
    EM_ANDAMENTO: ['RESPONDIDA', 'ACEITA'],
    HISTORICO: ['RECUSADA', 'CONCLUIDA', 'CANCELADA'],
  };
  const where: Prisma.SolicitacaoOrcamentoWhereInput = {
    profissionalId,
    ...(query.status
      ? { status: query.status }
      : query.grupo ? { status: { in: grupos[query.grupo] } } : {}),
  };

  const [total, itens] = await Promise.all([
    prisma.solicitacaoOrcamento.count({ where }),
    prisma.solicitacaoOrcamento.findMany({
      where,
      include: {
        categoria: true,
        cliente: { select: { id: true, nome: true, telefone: true, telefoneVerificado: true } },
      },
      // Desempate por ID evita itens repetidos entre páginas com mesmo timestamp.
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
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
      // Desempate por ID evita itens repetidos entre páginas com mesmo timestamp.
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
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
    throw new SolicitacaoError('Solicitação não encontrada', 404);
  }

  const permitidas = TRANSICOES_PROFISSIONAL[solicitacao.status] ?? [];
  if (!permitidas.includes(input.status)) {
    throw new SolicitacaoError(
      `Não é possível mudar de ${solicitacao.status} para ${input.status}`,
      400
    );
  }

  const resultado = await prisma.$transaction(async (tx) => {
    // Evita dois cliques simultâneos criando respostas e notificações conflitantes.
    const atualizado = await tx.solicitacaoOrcamento.updateMany({
      where: { id: solicitacaoId, profissionalId, status: solicitacao.status },
      data: { status: input.status },
    });
    if (atualizado.count !== 1) {
      throw new SolicitacaoError('O pedido mudou de status. Atualize a página e tente novamente.', 409);
    }

    const aviso = AVISOS_CLIENTE[input.status as keyof typeof AVISOS_CLIENTE];
    const avisoPush = aviso ? await tx.notificacao.create({
      data: {
        destinatarioId: solicitacao.clienteId,
        solicitacaoId,
        tipo: aviso.tipo,
        titulo: aviso.titulo,
        mensagem: aviso.mensagem,
      },
    }) : null;
    const pedido = await tx.solicitacaoOrcamento.findUniqueOrThrow({ where: { id: solicitacaoId } });
    return { pedido, avisoPush };
  });

  if (resultado.avisoPush) {
    await enviarPushNotificacao(solicitacao.clienteId, resultado.avisoPush).catch((erro) => {
      console.error('[push] falha após atualização', erro instanceof Error ? erro.name : 'desconhecida');
    });
  }
  return resultado.pedido;
}

export async function cancelarComoCliente(clienteId: string, solicitacaoId: string) {
  const solicitacao = await prisma.solicitacaoOrcamento.findUnique({ where: { id: solicitacaoId } });

  if (!solicitacao || solicitacao.clienteId !== clienteId) {
    throw new SolicitacaoError('Solicitação não encontrada', 404);
  }

  const permitidas = TRANSICOES_CLIENTE[solicitacao.status] ?? [];
  if (!permitidas.includes('CANCELADA')) {
    throw new SolicitacaoError(`Não é possível cancelar uma solicitação ${solicitacao.status}`, 400);
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.solicitacaoOrcamento.updateMany({
      where: { id: solicitacaoId, clienteId, status: solicitacao.status },
      data: { status: 'CANCELADA' },
    });
    if (atualizado.count !== 1) {
      throw new SolicitacaoError('O pedido mudou de status. Atualize a página e tente novamente.', 409);
    }
    const avisoPush = await tx.notificacao.create({
      data: {
        destinatarioId: solicitacao.profissionalId,
        solicitacaoId,
        tipo: 'SOLICITACAO_CANCELADA',
        titulo: 'Um pedido foi cancelado',
        mensagem: 'O cliente cancelou uma solicitação. Confira os pedidos no seu painel.',
      },
    });
    const pedido = await tx.solicitacaoOrcamento.findUniqueOrThrow({ where: { id: solicitacaoId } });
    return { pedido, avisoPush };
  });

  await enviarPushNotificacao(solicitacao.profissionalId, resultado.avisoPush).catch((erro) => {
    console.error('[push] falha após cancelamento', erro instanceof Error ? erro.name : 'desconhecida');
  });
  return resultado.pedido;
}

export { SolicitacaoError };
