import webpush from 'web-push';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

export interface DadosAssinatura {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const DOMINIOS_PUSH = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
  'push.apple.com',
];

export function endpointPushPermitido(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        url.hash || url.hostname.endsWith('.') || url.hostname.includes('..')) return false;
    const host = url.hostname.toLowerCase();
    return DOMINIOS_PUSH.includes(host) ||
      host.endsWith('.push.apple.com') ||
      host.endsWith('.notify.windows.com');
  } catch {
    return false;
  }
}

function configVapid() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

export function chavePublicaPush(): string | null {
  return configVapid()?.publicKey ?? null;
}

export class PushError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function cadastrarAssinaturaPush(usuarioId: string, assinatura: DadosAssinatura) {
  if (!configVapid()) throw new PushError('Notificações push ainda não configuradas', 503);
  if (!endpointPushPermitido(assinatura.endpoint)) {
    throw new PushError('Servidor de notificações não reconhecido', 400);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId }, select: { ativo: true },
  });
  if (!usuario?.ativo) throw new PushError('Conta inativa', 403);

  const existente = await prisma.assinaturaPush.findUnique({
    where: { endpoint: assinatura.endpoint }, select: { usuarioId: true },
  });
  if (!existente) {
    const quantidade = await prisma.assinaturaPush.count({ where: { usuarioId } });
    if (quantidade >= 5) {
      throw new PushError('Limite de dispositivos atingido. Desative um dispositivo antigo.', 429);
    }
  }

  // O mesmo navegador pode trocar de conta; o endpoint pertence à última
  // conta que autorizou os alertas nesse navegador.
  const registro = await prisma.assinaturaPush.upsert({
    where: { endpoint: assinatura.endpoint },
    create: {
      usuarioId, endpoint: assinatura.endpoint,
      chaveP256dh: assinatura.keys.p256dh, chaveAuth: assinatura.keys.auth,
    },
    update: {
      usuarioId, chaveP256dh: assinatura.keys.p256dh, chaveAuth: assinatura.keys.auth,
    },
    select: { id: true },
  });
  return registro;
}

export async function removerAssinaturaPush(usuarioId: string, endpoint: string) {
  await prisma.assinaturaPush.deleteMany({ where: { usuarioId, endpoint } });
}

export interface MensagemPush {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
}

/**
 * Envia após a transação do pedido ter sido confirmada.
 * Uma falha no serviço externo não desfaz o pedido nem a notificação interna.
 */
export async function enviarPushNotificacao(destinatarioId: string, aviso: MensagemPush): Promise<void> {
  const vapid = configVapid();
  if (!vapid) return;

  const usuario = await prisma.usuario.findUnique({
    where: { id: destinatarioId }, select: { ativo: true },
  });
  if (!usuario?.ativo) return;

  const assinaturas = await prisma.assinaturaPush.findMany({
    where: { usuarioId: destinatarioId }, take: 5,
  });
  if (!assinaturas.length) return;

  const destino = aviso.tipo === 'NOVA_SOLICITACAO' || aviso.tipo === 'SOLICITACAO_CANCELADA'
    ? '/painel' : '/minhas-solicitacoes';
  const payload = JSON.stringify({
    title: aviso.titulo,
    body: aviso.mensagem,
    url: destino,
    tag: aviso.id,
  });

  await Promise.all(assinaturas.map(async (assinatura) => {
    try {
      const resultado = await webpush.sendNotification(
        {
          endpoint: assinatura.endpoint,
          keys: { p256dh: assinatura.chaveP256dh, auth: assinatura.chaveAuth },
        },
        payload,
        { vapidDetails: vapid, TTL: 3600, urgency: 'high', timeout: 4000 }
      );
      // Aceitação pelo provedor de push NÃO comprova exibição no aparelho.
      // Não registrar endpoint, chaves ou conteúdo da notificação.
      console.info('[push] aceito pelo provedor', { statusCode: resultado.statusCode });
    } catch (err) {
      const codigo = (err as { statusCode?: number }).statusCode;
      if (codigo === 404 || codigo === 410) {
        await prisma.assinaturaPush.deleteMany({
          where: { id: assinatura.id, usuarioId: destinatarioId },
        }).catch(() => undefined);
      }
      // Nunca registrar endpoint, chave, URL completa ou dados pessoais no log.
      console.error('[push] falha de entrega', { statusCode: codigo ?? 'rede' });
    }
  }));
}


/**
 * Diagnóstico isolado, sem gerar solicitação ou notificação interna.
 * A mensagem é disparada pelo SERVIDOR 12 segundos após o toque, permitindo
 * bloquear o celular e conferir se o service worker foi realmente acordado.
 *
 * Dados efêmeros ficam em Redis por 15 minutos. Nada do endpoint/chaves do
 * dispositivo é persistido na telemetria ou devolvido pelo status.
 */
const ATRASO_TESTE_MS = 12_000;
const VALIDADE_TESTE_SEGUNDOS = 900;

function chaveTeste(id: string) {
  return `lartop:push-diagnostico:${id}`;
}

function hashConfirmacao(segredo: string) {
  return createHash('sha256').update(segredo).digest('hex');
}

async function executarEnvioTeste(
  id: string,
  assinatura: { id: string; usuarioId: string; endpoint: string; chaveP256dh: string; chaveAuth: string },
  segredo: string,
) {
  const vapid = configVapid();
  if (!vapid) {
    await redis.hset(chaveTeste(id), 'provedor', 'indisponivel');
    return;
  }
  try {
    const resultado = await webpush.sendNotification({
      endpoint: assinatura.endpoint,
      keys: { p256dh: assinatura.chaveP256dh, auth: assinatura.chaveAuth },
    }, JSON.stringify({
      title: 'Teste de notificações Lartop',
      body: 'O aviso de teste chegou ao seu celular? Ele não é um pedido real.',
      url: '/painel',
      tag: id,
      diagnostico: { id, segredo },
    }), { vapidDetails: vapid, TTL: 180, urgency: 'high', timeout: 8000 });
    await redis.hset(chaveTeste(id), 'provedor', resultado.statusCode >= 200 && resultado.statusCode < 300 ? 'aceito' : 'erro');
    // Aceitação não significa apresentação pelo Android.
    console.info('[push-teste] resposta do provedor', { statusCode: resultado.statusCode });
  } catch (erro) {
    const codigo = (erro as { statusCode?: number }).statusCode;
    if (codigo === 404 || codigo === 410) {
      await prisma.assinaturaPush.deleteMany({
        where: { id: assinatura.id, usuarioId: assinatura.usuarioId },
      }).catch(() => undefined);
    }
    await redis.hset(chaveTeste(id), 'provedor', codigo === 404 || codigo === 410 ? 'expirado' : 'erro').catch(() => undefined);
    console.error('[push-teste] falha do provedor', { statusCode: codigo ?? 'rede' });
  }
}

export async function agendarPushTeste(usuarioId: string, endpoint: string) {
  if (!configVapid()) throw new PushError('Notificações Push não estão configuradas', 503);

  const assinatura = await prisma.assinaturaPush.findFirst({
    where: { usuarioId, endpoint },
  });
  if (!assinatura) {
    throw new PushError('Este aparelho não está registrado. Repare os alertas antes do teste.', 409);
  }

  // Previne spam mesmo se houver muitas inscrições da mesma conta.
  const permitido = await redis.set(`lartop:push-teste:limite:${usuarioId}`, '1', 'EX', 60, 'NX');
  if (permitido !== 'OK') {
    throw new PushError('Aguarde um minuto antes de iniciar outro teste.', 429);
  }

  const id = randomUUID();
  const segredo = randomBytes(32).toString('hex');
  const key = chaveTeste(id);
  await redis.hset(key,
    'usuarioId', usuarioId,
    'segredoHash', hashConfirmacao(segredo),
    'provedor', 'agendado',
    'worker', 'aguardando',
  );
  await redis.expire(key, VALIDADE_TESTE_SEGUNDOS);

  // O envio roda no servidor, independente de o celular estar em primeiro
  // plano. Um reinício durante os 12s pode cancelar ESTE teste; não pedidos.
  setTimeout(() => {
    void executarEnvioTeste(id, assinatura, segredo).catch(() => {
      console.error('[push-teste] falha inesperada no diagnóstico');
    });
  }, ATRASO_TESTE_MS);

  return { id, atrasoSegundos: ATRASO_TESTE_MS / 1000 };
}

export async function consultarPushTeste(usuarioId: string, id: string) {
  const dados = await redis.hgetall(chaveTeste(id));
  if (!dados.usuarioId || dados.usuarioId !== usuarioId) {
    throw new PushError('Teste não encontrado', 404);
  }
  return {
    provedor: dados.provedor ?? 'agendado',
    worker: dados.worker ?? 'aguardando',
  };
}

/** Recebimento autenticado por segredo aleatório transportado DENTRO do Push. */
export async function confirmarPushTeste(id: string, segredo: string, estado: 'exibida' | 'falha') {
  const key = chaveTeste(id);
  const dados = await redis.hgetall(key);
  if (!dados.segredoHash || !/^[a-f0-9]{64}$/.test(dados.segredoHash)) {
    throw new PushError('Teste não encontrado', 404);
  }
  const esperado = Buffer.from(dados.segredoHash, 'hex');
  const recebido = Buffer.from(hashConfirmacao(segredo), 'hex');
  if (!timingSafeEqual(esperado, recebido)) {
    throw new PushError('Confirmação inválida', 403);
  }
  await redis.hset(key, 'worker', estado === 'exibida' ? 'showNotification_ok' : 'showNotification_falhou');
}
