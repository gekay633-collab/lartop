import { createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { enviarPushNotificacao } from '../push/push.service.js';
import { registrarEvento } from '../evento/evento.service.js';
import { gerarLinkWhatsappRapido } from '../../lib/whatsapp.js';
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
  local ip = tonumber(redis.call('GET', KEYS[1]) or '0')
  local numero = tonumber(redis.call('GET', KEYS[2]) or '0')
  if ip >= tonumber(ARGV[1]) or numero >= tonumber(ARGV[2]) then return 0 end
  ip = redis.call('INCR', KEYS[1])
  if ip == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3])) end
  numero = redis.call('INCR', KEYS[2])
  if numero == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4])) end
  return 1
`;

export async function permitirPedidoRapido(ip: string, telefone: string): Promise<boolean> {
  // IP é o de Fastify, sem confiar em cabeçalhos X-Forwarded-For arbitrários.
  // Não armazenar o IP nem o telefone em claro nas chaves de Redis.
  return Number(await redis.eval(
    SCRIPT_COTA, 2,
    `limite:rapidas:ip:${hash(ip)}`,
    `limite:rapidas:telefone:${hash(telefone)}`,
    '30', '8', '60', '86400',
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
  categoria: { nome: string };
  profissional: { nomeExibicao: string };
}, telefoneProfissional: string) {
  return {
    id: pedido.id,
    status: pedido.status,
    criadoEm: pedido.criadoEm,
    categoria: { nome: pedido.categoria.nome },
    profissional: { nomeExibicao: pedido.profissional.nomeExibicao },
    linkWhatsapp: gerarLinkWhatsappRapido(telefoneProfissional, {
      nomeCliente: pedido.clienteNomeRapido ?? 'Cliente LARTOP',
      categoriaNome: pedido.categoria.nome,
      descricao: pedido.descricao ?? '',
      pedidoId: pedido.id,
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

export async function acompanharSolicitacaoRapida(id: string, token: string) {
  const pedido = await prisma.solicitacaoOrcamento.findUnique({
    where: { id },
    include: incluirPedido,
  });
  if (!pedido || pedido.clienteId !== null || !pedido.acessoExpiraEm ||
      pedido.acessoExpiraEm <= new Date() ||
      !compararHash(pedido.acessoTokenHash, hash(token))) {
    throw new SolicitacaoRapidaError('Link inválido ou expirado.', 404);
  }
  const profissional = await prisma.usuario.findUnique({
    where: { id: pedido.profissionalId }, select: { telefone: true },
  });
  // O acesso ao status continua funcionando se o perfil deixar de ser publicado.
  const resposta = {
    id: pedido.id,
    status: pedido.status,
    criadoEm: pedido.criadoEm,
    categoria: { nome: pedido.categoria.nome },
    profissional: { nomeExibicao: pedido.profissional.nomeExibicao },
    ...(profissional?.telefone ? { linkWhatsapp: gerarLinkWhatsappRapido(profissional.telefone, {
      nomeCliente: pedido.clienteNomeRapido ?? 'Cliente LARTOP',
      categoriaNome: pedido.categoria.nome,
      descricao: pedido.descricao ?? '',
      pedidoId: pedido.id,
    }) } : {}),
  };
  return resposta;
}
