import { createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { enviarPushNotificacao } from '../push/push.service.js';
import { registrarEvento } from '../evento/evento.service.js';
import { gerarLinkWhatsappRapido, referenciaPedidoCincoDigitos } from '../../lib/whatsapp.js';
import type { CriarSolicitacaoRapidaInput } from './solicitacao.rapida.schemas.js';

export class SolicitacaoRapidaError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const hash = (valor: string) => createHash('sha256').update(valor).digest('hex');
const chaveTentativa = (id: string) => hash('lartop:rapida:' + id);
const hashDados = (p: CriarSolicitacaoRapidaInput) =>
  hash(JSON.stringify([p.profissionalId, p.categoriaId, p.nome, p.whatsapp, p.descricao]));
const expiraEm = () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

function compararHash(a: string | null, b: string): boolean {
  if (!a || !/^[a-f0-9]{64}$/.test(a)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

// Um telefone informado NÃO é verificação de identidade. Limites reduzem abuso,
// mas não impedem todos os pedidos falsos; monitorar e ajustar em operação.
const SCRIPT_COTA = `
  local totalProfissional = tonumber(redis.call('GET', KEYS[1]) or '0')
  local numero = tonumber(redis.call('GET', KEYS[2]) or '0')
  if totalProfissional >= tonumber(ARGV[1]) or numero >= tonumber(ARGV[2]) then return 0 end
  totalProfissional = redis.call('INCR', KEYS[1])
  if totalProfissional == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3])) end
  numero = redis.call('INCR', KEYS[2])
  if numero == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4])) end
  return 1
`;

export async function permitirPedidoRapido(profissionalId: string, telefone: string): Promise<boolean> {
  // O backend recebe chamadas pelo BFF da Vercel: request.ip não identifica
  // necessariamente o visitante. Limitar pelo IP da Vercel bloquearia outros
  // clientes legítimos. A cota por prestador+telefone funciona entre réplicas.
  // Não armazenar telefone em claro nas chaves de Redis.
  return Number(await redis.eval(
    SCRIPT_COTA, 2,
    `limite:rapidas:profissional:${hash(profissionalId)}`,
    `limite:rapidas:telefone:${hash(telefone)}`,
    '20', '8', '60', '86400',
  )) === 1;
}

const incluirPedido = {
  categoria: { select: { nome: true } },
  profissional: { select: { nomeExibicao: true, cidadeId: true } },
} as const;

function respostaRapida(pedido: {
  id: string;
  status: string;
  criadoEm: Date;
  clienteNomeRapido: string | null;
  descricao: string | null;
  referenciaCurta: number | null;
  categoria: { nome: string };
  profissional: { nomeExibicao: string };
}, telefoneProfissional: string) {
  return {
    id: pedido.id,
    referencia: referenciaPedidoCincoDigitos(pedido.id, pedido.referenciaCurta),
    status: pedido.status,
    criadoEm: pedido.criadoEm,
    categoria: { nome: pedido.categoria.nome },
    profissional: { nomeExibicao: pedido.profissional.nomeExibicao },
    linkWhatsapp: gerarLinkWhatsappRapido(telefoneProfissional, {
      nomeCliente: pedido.clienteNomeRapido ?? 'Cliente LARTOP',
      categoriaNome: pedido.categoria.nome,
      descricao: pedido.descricao ?? '',
      pedidoId: pedido.id,
      referenciaCurta: pedido.referenciaCurta,
    }),
  };
}

export async function consultarReenvioRapido(input: CriarSolicitacaoRapidaInput) {
  const pedido = await prisma.solicitacaoOrcamento.findUnique({
    where: { idempotencyKey: chaveTentativa(input.tentativaId) },
    include: incluirPedido,
  });
  if (!pedido) return null;
  if (pedido.clienteId !== null ||
      pedido.idempotencyHash !== hashDados(input) ||
      !compararHash(pedido.acessoTokenHash, hash(input.token))) {
    throw new SolicitacaoRapidaError('Esta tentativa não pode ser reutilizada.', 409);
  }
  const profissional = await prisma.usuario.findUnique({
    where: { id: pedido.profissionalId }, select: { telefone: true },
  });
  if (!profissional?.telefone) throw new SolicitacaoRapidaError('Contato temporariamente indisponível.', 409);
  return respostaRapida(pedido, profissional.telefone);
}

export async function criarSolicitacaoRapida(input: CriarSolicitacaoRapidaInput) {
  const anterior = await consultarReenvioRapido(input);
  if (anterior) return anterior;

  const profissional = await prisma.perfilProfissional.findUnique({
    where: { usuarioId: input.profissionalId },
    include: { usuario: { select: { telefone: true, ativo: true } } },
  });
  if (!profissional?.perfilPublicado || !profissional.usuario.ativo || !profissional.usuario.telefone) {
    throw new SolicitacaoRapidaError('Profissional indisponível para solicitações.', 404);
  }
  const categoria = await prisma.profissionalCategoria.findUnique({
    where: { profissionalId_categoriaId: {
      profissionalId: input.profissionalId, categoriaId: input.categoriaId,
    } },
    include: { categoria: { select: { nome: true, ativo: true } } },
  });
  if (!categoria?.categoria.ativo) throw new SolicitacaoRapidaError('Serviço indisponível para esse profissional.', 400);

  let resultado;
  try {
    resultado = await prisma.$transaction(async (tx) => {
      const pedido = await tx.solicitacaoOrcamento.create({
        data: {
          clienteId: null,
          profissionalId: input.profissionalId,
          categoriaId: input.categoriaId,
          cep: null, endereco: null, tamanhoM2: null,
          clienteNomeRapido: input.nome,
          clienteWhatsappRapido: input.whatsapp,
          acessoTokenHash: hash(input.token),
          acessoExpiraEm: expiraEm(),
          descricao: input.descricao,
          idempotencyKey: chaveTentativa(input.tentativaId),
          idempotencyHash: hashDados(input),
        },
        include: incluirPedido,
      });
      const aviso = await tx.notificacao.create({
        data: {
          destinatarioId: input.profissionalId,
          solicitacaoId: pedido.id,
          tipo: 'NOVA_SOLICITACAO',
          titulo: 'Novo pedido de orçamento',
          mensagem: 'Um cliente solicitou um serviço. Confira o pedido no painel da LARTOP.',
        },
      });
      return { pedido, aviso };
    });
  } catch (erro) {
    if (erro && typeof erro === 'object' && 'code' in erro && erro.code === 'P2002') {
      const reenviado = await consultarReenvioRapido(input);
      if (reenviado) return reenviado;
    }
    throw erro;
  }

  // O pedido e o aviso interno persistem mesmo se Web Push falhar.
  await enviarPushNotificacao(input.profissionalId, resultado.aviso).catch((erro) => {
    console.error('[push] falha no pedido rápido', erro instanceof Error ? erro.name : 'desconhecida');
  });
  void registrarEvento({
    tipo: 'CONTATO_GERADO',
    cidadeId: profissional.cidadeId,
    categoriaId: input.categoriaId,
    profissionalId: input.profissionalId,
  });
  return respostaRapida(resultado.pedido, profissional.usuario.telefone);
}

export async function validarAcessoSolicitacaoRapida(id: string, token: string) {
  const pedido = await prisma.solicitacaoOrcamento.findUnique({
    where: { id },
    include: incluirPedido,
  });
  if (!pedido || pedido.clienteId !== null || !pedido.acessoExpiraEm ||
      pedido.acessoExpiraEm <= new Date() ||
      !compararHash(pedido.acessoTokenHash, hash(token))) {
    throw new SolicitacaoRapidaError('Link inválido ou expirado.', 404);
  }
  return pedido;
}

export async function acompanharSolicitacaoRapida(id: string, token: string) {
  const pedido = await validarAcessoSolicitacaoRapida(id, token);
  const [profissional, avaliacao] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: pedido.profissionalId }, select: { telefone: true },
    }),
    prisma.avaliacaoVisitante.findUnique({
      where: { solicitacaoId: pedido.id }, select: { nota: true, comentario: true },
    }),
  ]);
  const _telefone = profissional?.telefone;
  // Consulta por link nunca devolve o token nem informações do cliente.
  const resposta = {
    id: pedido.id,
    referencia: referenciaPedidoCincoDigitos(pedido.id, pedido.referenciaCurta),
    status: pedido.status,
    criadoEm: pedido.criadoEm,
    jaAvaliada: Boolean(avaliacao),
    ...(avaliacao ? { avaliacao: { nota: avaliacao.nota, comentario: avaliacao.comentario } } : {}),
    categoria: { nome: pedido.categoria.nome },
    profissional: { nomeExibicao: pedido.profissional.nomeExibicao },
    ...(_telefone ? { linkWhatsapp: gerarLinkWhatsappRapido(_telefone, {
      nomeCliente: pedido.clienteNomeRapido ?? 'Cliente LARTOP',
      categoriaNome: pedido.categoria.nome,
      descricao: pedido.descricao ?? '',
      pedidoId: pedido.id,
      referenciaCurta: pedido.referenciaCurta,
    }) } : {}),
  };
  return resposta;
}
