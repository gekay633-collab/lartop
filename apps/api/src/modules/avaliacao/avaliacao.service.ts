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
    throw new AvaliacaoError('Solicitação não encontrada', 404);
  }

  if (solicitacao.status !== 'CONCLUIDA') {
    throw new AvaliacaoError('Só é possível avaliar solicitações concluídas', 400);
  }

  const jaAvaliou = await prisma.avaliacao.findUnique({
    where: { solicitacaoId_avaliadorId: { solicitacaoId: input.solicitacaoId, avaliadorId: clienteId } },
  });
  if (jaAvaliou) {
    throw new AvaliacaoError('Você já avaliou essa solicitação', 409);
  }

  const avaliacao = await prisma.$transaction(async (tx: any) => {
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
    throw new AvaliacaoError('Solicitação não encontrada', 404);
  }

  if (solicitacao.status !== 'CONCLUIDA') {
    throw new AvaliacaoError('Só é possível avaliar solicitações concluídas', 400);
  }

  const jaAvaliou = await prisma.avaliacao.findUnique({
    where: {
      solicitacaoId_avaliadorId: { solicitacaoId: input.solicitacaoId, avaliadorId: profissionalId },
    },
  });
  if (jaAvaliou) {
    throw new AvaliacaoError('Você já avaliou essa solicitação', 409);
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
  // Perfis despublicados ou contas bloqueadas não podem ter histórico e
  // nomes de avaliadores divulgados por um endpoint público avulso.
  const visivel = await prisma.perfilProfissional.findFirst({
    where: { usuarioId: profissionalId, perfilPublicado: true, usuario: { ativo: true } },
    select: { usuarioId: true },
  });
  if (!visivel) return [];
  return prisma.avaliacao.findMany({
    where: { avaliadoId: profissionalId, tipo: 'CLIENTE_AVALIA_PROFISSIONAL' },
    select: {
      id: true, nota: true, comentario: true, criadoEm: true,
      avaliador: { select: { nome: true } },
    },
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
