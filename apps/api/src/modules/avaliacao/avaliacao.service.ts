import { prisma } from '../../lib/prisma.js';
import type { CriarAvaliacaoInput } from './avaliacao.schemas.js';

class AvaliacaoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function avaliarComoCliente(clienteId: string, input: CriarAvaliacaoInput) {
  const solicitacao = await prisma.solicitacaoOrcamento.findUnique({
    where: { id: input.solicitacaoId },
  });

  if (!solicitacao || solicitacao.clienteId !== clienteId) {
    throw new AvaliacaoError('Solicitacao nao encontrada', 404);
  }

  if (solicitacao.status !== 'CONCLUIDA') {
    throw new AvaliacaoError('So e possivel avaliar solicitacoes concluidas', 400);
  }

  const jaAvaliou = await prisma.avaliacao.findUnique({
    where: { solicitacaoId_avaliadorId: { solicitacaoId: input.solicitacaoId, avaliadorId: clienteId } },
  });
  if (jaAvaliou) {
    throw new AvaliacaoError('Voce ja avaliou essa solicitacao', 409);
  }

  const avaliacao = await prisma.$transaction(async (tx) => {
    const novaAvaliacao = await tx.avaliacao.create({
      data: {
        solicitacaoId: input.solicitacaoId,
        avaliadorId: clienteId,
        avaliadoId: solicitacao.profissionalId,
        tipo: 'CLIENTE_AVALIA_PROFISSIONAL',
        nota: input.nota,
        comentario: input.comentario,
      },
    });

    await recalcularNotaMediaProfissional(tx, solicitacao.profissionalId);

    return novaAvaliacao;
  });

  return avaliacao;
}

export async function avaliarComoProfissional(profissionalId: string, input: CriarAvaliacaoInput) {
  const solicitacao = await prisma.solicitacaoOrcamento.findUnique({
    where: { id: input.solicitacaoId },
  });

  if (!solicitacao || solicitacao.profissionalId !== profissionalId) {
    throw new AvaliacaoError('Solicitacao nao encontrada', 404);
  }

  if (solicitacao.status !== 'CONCLUIDA') {
    throw new AvaliacaoError('So e possivel avaliar solicitacoes concluidas', 400);
  }

  const jaAvaliou = await prisma.avaliacao.findUnique({
    where: {
      solicitacaoId_avaliadorId: { solicitacaoId: input.solicitacaoId, avaliadorId: profissionalId },
    },
  });
  if (jaAvaliou) {
    throw new AvaliacaoError('Voce ja avaliou essa solicitacao', 409);
  }

  const avaliacao = await prisma.avaliacao.create({
    data: {
      solicitacaoId: input.solicitacaoId,
      avaliadorId: profissionalId,
      avaliadoId: solicitacao.clienteId,
      tipo: 'PROFISSIONAL_AVALIA_CLIENTE',
      nota: input.nota,
      comentario: input.comentario,
    },
  });

  return avaliacao;
}

export async function listarAvaliacoesDoProfissional(profissionalId: string) {
  return prisma.avaliacao.findMany({
    where: { avaliadoId: profissionalId, tipo: 'CLIENTE_AVALIA_PROFISSIONAL' },
    include: { avaliador: { select: { nome: true } } },
    orderBy: { criadoEm: 'desc' },
  });
}

async function recalcularNotaMediaProfissional(tx: any, profissionalId: string) {
  const agregado = await tx.avaliacao.aggregate({
    where: { avaliadoId: profissionalId, tipo: 'CLIENTE_AVALIA_PROFISSIONAL' },
    _avg: { nota: true },
    _count: { nota: true },
  });

  await tx.perfilProfissional.update({
    where: { usuarioId: profissionalId },
    data: {
      notaMedia: agregado._avg.nota ?? 0,
      totalAvaliacoes: agregado._count.nota,
    },
  });
}

export { AvaliacaoError };
