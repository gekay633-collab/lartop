import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { emitirTokens, renovarTokens, revogarSessao } from './auth.service.js';
import { verificarRefreshToken } from '../../lib/jwt.js';

// Nenhuma execução contra Supabase, Railway ou bancos de produção.
const dbUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const bancoLocal = (url: string | undefined) => !!url &&
  ['127.0.0.1', 'localhost'].includes(new URL(url).hostname);
if (process.env.NOTIFICACOES_TEST_DB !== 'isolated' ||
    !bancoLocal(dbUrl) || !bancoLocal(directUrl) || !bancoLocal(redisUrl)) {
  throw new Error('Testes de sessão exigem PostgreSQL e Redis locais descartáveis.');
}

describe('segurança das sessões com banco e Redis isolados', () => {
  it('impede reutilização e revogação indevida de refresh token', async () => {
    const id = randomUUID();
    const email = `teste-sessao-${id}@example.test`;
    await prisma.usuario.create({
      data: { id, email, nome: 'Teste de sessão', senhaHash: 'nao-usada', tipo: 'CLIENTE' },
    });
    try {
      const primeira = await emitirTokens(id, 'CLIENTE');
      const segunda = await emitirTokens(id, 'CLIENTE');
      assert.notEqual(primeira.refreshToken, segunda.refreshToken, 'tokens devem ser distintos');
      assert.notEqual(
        verificarRefreshToken(primeira.refreshToken).jti,
        verificarRefreshToken(segunda.refreshToken).jti
      );

      const renovada = await renovarTokens(primeira.refreshToken);
      assert.ok(renovada.accessToken);
      await assert.rejects(renovarTokens(primeira.refreshToken), /Sessão expirada ou revogada/);

      await revogarSessao(id);
      await assert.rejects(renovarTokens(segunda.refreshToken), /Sessão expirada ou revogada/);
      await assert.rejects(renovarTokens(renovada.refreshToken), /Sessão expirada ou revogada/);

      const antesDaTroca = await emitirTokens(id, 'CLIENTE');
      // Mesmo sem revogação no Redis, o JWT antigo não pode renovar após mudar a senha.
      await prisma.usuario.update({ where: { id }, data: { senhaHash: 'nova-senha-de-teste' } });
      await assert.rejects(renovarTokens(antesDaTroca.refreshToken), /Credenciais alteradas/);

      const ativa = await emitirTokens(id, 'CLIENTE');
      await prisma.usuario.update({ where: { id }, data: { ativo: false } });
      await assert.rejects(renovarTokens(ativa.refreshToken), /Usuário inválido/);
    } finally {
      await revogarSessao(id);
      await prisma.usuario.delete({ where: { id } });
      await prisma.$disconnect();
      redis.disconnect();
    }
  });
});
