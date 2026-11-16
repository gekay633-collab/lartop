import { prisma } from '../../lib/prisma.js';
import type { CriarAvaliacaoInput } from './avaliacao.schemas.js';
import { AVISO_NOVA_AVALIACAO } from '../notificacao/notificacao.eventos.js';
import { enviarPushNotificacao } from '../push/push.service.js';

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

  let resultado;
  try {
    resultado = await prisma.$transaction(async (tx: any) => {
      const avaliacao = await tx.avaliacao.create({
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

      // Persistir o aviso junto com a avaliação. Nunca enviar Push antes do commit.
      const avisoPush = await tx.notificacao.create({
        data: {
          destinatarioId: solicitacao.profissionalId,
          solicitacaoId: solicitacao.id,
          ...AVISO_NOVA_AVALIACAO,
        },
      });

      return { avaliacao, avisoPush };
    });
  } catch (erro) {
    // Duas abas podem enviar a mesma avaliação ao mesmo tempo.
    // O índice único no banco impede a duplicação; devolvemos 409, não 500.
    if (erro && typeof erro === 'object' && 'code' in erro && erro.code === 'P2002') {
      throw new AvaliacaoError('Você já avaliou essa solicitação', 409);
    }
    throw erro;
  }

  await enviarPushNotificacao(solicitacao.profissionalId, resultado.avisoPush).catch((erro) => {
    console.error('[push] falha após avaliação', erro instanceof Error ? erro.name : 'desconhecida');
  });

  return resultado.avaliacao;
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
