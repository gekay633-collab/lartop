import { prisma } from '../../lib/prisma.js';
import { recalcularNotaMediaProfissional } from './avaliacao.service.js';
import { enviarPushNotificacao } from '../push/push.service.js';
import { SolicitacaoRapidaError, validarAcessoSolicitacaoRapida } from '../solicitacao/solicitacao.rapida.service.js';
import type { AvaliarSolicitacaoRapidaInput, AlterarNomePublicoInput } from './avaliacao.rapida.schemas.js';
import { primeiroNomePublico } from './avaliacao.nome-publico.js';

/**
 * A credencial é o link privado de acompanhamento (256 bits).
 * A referência de cinco dígitos é PÚBLICA e nunca autoriza avaliar.
 */
export async function avaliarSolicitacaoRapida(
  solicitacaoId: string, input: AvaliarSolicitacaoRapidaInput,
) {
  const pedido = await validarAcessoSolicitacaoRapida(solicitacaoId, input.token);
  if (pedido.status !== 'CONCLUIDA') {
    throw new SolicitacaoRapidaError('O prestador ainda não marcou este serviço como concluído.', 409);
  }

  let criado;
  try {
    criado = await prisma.$transaction(async (tx) => {
      // O índice UNIQUE(solicitacao_id) garante 1 avaliação, inclusive com
      // cliques simultâneos ou solicitações vindas de dispositivos distintos.
      const avaliacao = await tx.avaliacaoVisitante.create({
        data: {
          solicitacaoId: pedido.id,
          nota: input.nota,
          comentario: input.comentario || null,
          nomePublico: input.publicarPrimeiroNome ? primeiroNomePublico(pedido.clienteNomeRapido) : null,
        },
      });

      await recalcularNotaMediaProfissional(tx, pedido.profissionalId);

      const aviso = await tx.notificacao.create({
        data: {
          destinatarioId: pedido.profissionalId,
          solicitacaoId: pedido.id,
          tipo: 'NOVA_AVALIACAO',
          titulo: 'Você recebeu uma avaliação',
          mensagem: 'Um cliente avaliou seu atendimento. Confira seu perfil na LARTOP.',
        },
      });
      return { avaliacao, aviso };
    });
  } catch (erro) {
    if (erro && typeof erro === 'object' && 'code' in erro && erro.code === 'P2002') {
      throw new SolicitacaoRapidaError('Esta solicitação já recebeu um feedback.', 409);
    }
    throw erro;
  }

  // Nunca bloquear ou desfazer o feedback se um celular não receber o push.
  await enviarPushNotificacao(pedido.profissionalId, criado.aviso).catch((erro) => {
    console.error('[push] falha no feedback visitante', erro instanceof Error ? erro.name : 'desconhecida');
  });

  return {
    id: criado.avaliacao.id,
    nota: criado.avaliacao.nota,
    comentario: criado.avaliacao.comentario,
    criadoEm: criado.avaliacao.criadoEm,
  };
}

/** Permite ajustar apenas a visibilidade do primeiro nome de uma avaliação
 * já existente; nota, comentário, pontuação e notificações nunca são alterados.
 */
export async function alterarNomePublicoAvaliacao(
  solicitacaoId: string, input: AlterarNomePublicoInput,
) {
  const pedido = await validarAcessoSolicitacaoRapida(solicitacaoId, input.token);
  const nomePublico = input.publicarPrimeiroNome
    ? primeiroNomePublico(pedido.clienteNomeRapido)
    : null;
  if (input.publicarPrimeiroNome && !nomePublico) {
    throw new SolicitacaoRapidaError('O primeiro nome informado não pode ser exibido publicamente.', 400);
  }
  const atualizado = await prisma.avaliacaoVisitante.updateMany({
    where: { solicitacaoId: pedido.id },
    data: { nomePublico },
  });
  if (atualizado.count === 0) {
    throw new SolicitacaoRapidaError('Nenhuma avaliação encontrada para este pedido.', 404);
  }
  return { nomePublico };
}
