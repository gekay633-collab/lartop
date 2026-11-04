import { randomUUID } from 'node:crypto';
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import autenticacaoPlugin from '../../plugins/autenticacao.js';
import { emitirTokens, revogarSessao } from '../auth/auth.service.js';
import { uploadRoutes, reconhecerImagem, LIMITE_IMAGEM_BYTES } from './upload.routes.js';

const local = (url: string | undefined) => !!url &&
  ['localhost', '127.0.0.1'].includes(new URL(url).hostname);
if (process.env.NOTIFICACOES_TEST_DB !== 'isolated' ||
    !local(process.env.DATABASE_URL) ||
    !local(process.env.DIRECT_DATABASE_URL) ||
    !local(process.env.REDIS_URL)) {
  throw new Error('Testes de upload só podem usar PostgreSQL e Redis locais isolados.');
}

describe('upload validado no servidor', () => {
  const id = randomUUID();
  let token = '';
  let app: ReturnType<typeof Fastify>;
  before(async () => {
    await prisma.usuario.create({
      data: { id, nome: 'Upload Teste', email: `upload-${id}@example.test`,
        senhaHash: 'somente-teste', tipo: 'PROFISSIONAL' },
    });
    token = (await emitirTokens(id, 'PROFISSIONAL')).accessToken;
    app = Fastify({ logger: false });
    await app.register(autenticacaoPlugin);
    await app.register(uploadRoutes, { prefix: '/api' });
    await app.ready();
  });
  after(async () => {
    if (app) await app.close();
    await revogarSessao(id);
    await prisma.usuario.delete({ where: { id } });
    await prisma.$disconnect();
    redis.disconnect();
  });

  it('identifica assinaturas reais dos formatos suportados', () => {
    assert.equal(reconhecerImagem(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])), 'image/png');
    assert.equal(reconhecerImagem(Buffer.from([255,216,255,0,0,0,0,0,0,0,0,0])), 'image/jpeg');
    assert.equal(reconhecerImagem(Buffer.from('RIFF0000WEBP')), 'image/webp');
    assert.equal(reconhecerImagem(Buffer.from('javascript:not-image')), null);
  });

  it('exige autenticação no novo endpoint', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/upload/imagem',
      headers: { 'content-type': 'image/png' },
      payload: Buffer.from('arquivo-rejeitado'),
    });
    assert.equal(res.statusCode, 401);
  });

  it('recusa MIME declarado divergente do arquivo antes de contatar Cloudinary', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/upload/imagem',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'image/png' },
      payload: Buffer.from('texto-sem-assinatura-de-imagem'),
    });
    assert.equal(res.statusCode, 400);
  });

  it('limita a 5 MB no parser, sem sequer enviar ao Cloudinary', async () => {
    const bytes = Buffer.alloc(LIMITE_IMAGEM_BYTES + 1, 0);
    const res = await app.inject({
      method: 'POST', url: '/api/upload/imagem',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'image/png' },
      payload: bytes,
    });
    assert.equal(res.statusCode, 413);
  });

  it('não emite assinaturas diretas quando o modo legado estiver desativado', async () => {
    const anterior = process.env.UPLOAD_ASSINATURA_LEGADO;
    delete process.env.UPLOAD_ASSINATURA_LEGADO;
    try {
      const res = await app.inject({
        method: 'POST', url: '/api/upload/assinatura',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 410);
    } finally {
      if (anterior === undefined) delete process.env.UPLOAD_ASSINATURA_LEGADO;
      else process.env.UPLOAD_ASSINATURA_LEGADO = anterior;
    }
  });
});
