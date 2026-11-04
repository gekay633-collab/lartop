import webpush from 'web-push';
import { prisma } from '../../lib/prisma.js';

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
      await webpush.sendNotification(
        {
          endpoint: assinatura.endpoint,
          keys: { p256dh: assinatura.chaveP256dh, auth: assinatura.chaveAuth },
        },
        payload,
        { vapidDetails: vapid, TTL: 3600, urgency: 'high', timeout: 4000 }
      );
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
