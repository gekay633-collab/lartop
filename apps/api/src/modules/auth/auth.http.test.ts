import { randomUUID } from 'node:crypto';
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { gerarHashSenha } from '../../lib/senha.js';
import { emitirTokens, renovarTokens, revogarSessao } from './auth.service.js';
import autenticacaoPlugin from '../../plugins/autenticacao.js';
import { authRoutes } from './auth.routes.js';
import { usuarioRoutes } from '../usuario/usuario.routes.js';

/** Teste HTTP com Fastify.inject + PostgreSQL e Redis locais descartáveis, nunca produção. */
const bancoLocal = (url: string | undefined) => !!url &&
  ['localhost', '127.0.0.1'].includes(new URL(url).hostname);

if (process.env.NOTIFICACOES_TEST_DB !== 'isolated' ||
    !bancoLocal(process.env.DATABASE_URL) ||
    !bancoLocal(process.env.DIRECT_DATABASE_URL) ||
    !bancoLocal(process.env.REDIS_URL)) {
  throw new Error('Testes HTTP de autenticação exigem banco e Redis isolados.');
}

function cookieSessao(resposta: { headers: Record<string, unknown> }): string {
  const header = resposta.headers['set-cookie'];
  const valor = Array.isArray(header) ? header[0] : header;
  assert.equal(typeof valor, 'string', 'O servidor deve definir o cookie HttpOnly');
  assert.match(valor as string, /lartop_refresh=/);
  assert.match(valor as string, /httponly/i);
  return (valor as string).split(';')[0];
}

describe('autenticação HTTP com duas sessões e recuperação de senha', () => {
  const id = randomUUID();
  const email = `auth-http-${id}@example.test`;
  const senhaOriginal = 'SenhaTeste123!aleatoria';
  const senhaNova = 'NovaSenha456!aleatoria';
  let app: ReturnType<typeof Fastify>;

  before(async () => {
    await prisma.usuario.create({
      data: { id, email, nome: 'Cliente Autenticacao', tipo: 'CLIENTE',
        senhaHash: await gerarHashSenha(senhaOriginal) },
    });
    app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(rateLimit, { global: false, redis });
    await app.register(autenticacaoPlugin);
    await app.register(authRoutes, { prefix: '/api' });
    await app.register(usuarioRoutes, { prefix: '/api' });
    await app.ready();
  });

  after(async () => {
    if (app) await app.close();
    await revogarSessao(id);
    await prisma.tokenRecuperacaoSenha.deleteMany({ where: { usuarioId: id } });
    await prisma.usuario.deleteMany({ where: { id } });
    await prisma.$disconnect();
    redis.disconnect();
  });

  it('login cria cookies HttpOnly; logout revoga só a sessão corrente e o access JWT', async () => {
    const login = () => app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email, senha: senhaOriginal },
    });
    const a = await login();
    const b = await login();
    assert.equal(a.statusCode, 200);
    assert.equal(b.statusCode, 200);
    const accessA = (a.json() as { accessToken: string }).accessToken;
    const accessB = (b.json() as { accessToken: string }).accessToken;
    assert.notEqual(accessA, accessB, 'JWTs de navegadores diferentes devem ser únicos');
    const cookieA = cookieSessao(a);
    const cookieB = cookieSessao(b);

    const acessoAntes = await app.inject({
      method: 'GET', url: '/api/usuarios/mim',
      headers: { authorization: `Bearer ${accessA}` },
    });
    assert.equal(acessoAntes.statusCode, 200);

    const logout = await app.inject({
      method: 'POST', url: '/api/auth/logout',
      headers: { cookie: cookieA, authorization: `Bearer ${accessA}` },
    });
    assert.equal(logout.statusCode, 200);

    const acessoDepois = await app.inject({
      method: 'GET', url: '/api/usuarios/mim',
      headers: { authorization: `Bearer ${accessA}` },
    });
    assert.equal(acessoDepois.statusCode, 401);
    assert.equal((await app.inject({
      method: 'POST', url: '/api/auth/refresh', headers: { cookie: cookieA },
    })).statusCode, 401);

    assert.equal((await app.inject({
      method: 'GET', url: '/api/usuarios/mim',
      headers: { authorization: `Bearer ${accessB}` },
    })).statusCode, 200);
    const refreshB = await app.inject({
      method: 'POST', url: '/api/auth/refresh', headers: { cookie: cookieB },
    });
    assert.equal(refreshB.statusCode, 200, 'logout do dispositivo A não pode desconectar B');

    const cookieBnovo = cookieSessao(refreshB);
    assert.equal((await app.inject({
      method: 'POST', url: '/api/auth/refresh', headers: { cookie: cookieB },
    })).statusCode, 401, 'token de renovação anterior não pode ser reutilizado');
    const respostaB = await app.inject({
      method: 'POST', url: '/api/auth/logout',
      headers: { cookie: cookieBnovo, authorization: `Bearer ${accessB}` },
    });
    assert.equal(respostaB.statusCode, 200);
  });

  it('renovações concorrentes com um mesmo token autorizam exatamente uma', async () => {
    const inicial = await emitirTokens(id, 'CLIENTE');
    const [a, b] = await Promise.allSettled([
      renovarTokens(inicial.refreshToken), renovarTokens(inicial.refreshToken),
    ]);
    assert.deepEqual([a.status, b.status].sort(), ['fulfilled', 'rejected']);
    const sucesso = [a, b].find((item) => item.status === 'fulfilled');
    if (sucesso?.status === 'fulfilled') {
      await revogarSessao(id);
    }
  });

  it('o mesmo link de recuperação de senha só pode ser utilizado uma vez', async () => {
    const token = randomUUID() + randomUUID();
    await prisma.tokenRecuperacaoSenha.create({
      data: { usuarioId: id, tokenHash: await gerarHashSenha(token),
        expiraEm: new Date(Date.now() + 3_600_000) },
    });
    const sessaoAntiga = await emitirTokens(id, 'CLIENTE');
    const payload = { usuarioId: id, token, novaSenha: senhaNova };
    const resposta = await app.inject({
      method: 'POST', url: '/api/auth/redefinir-senha', payload,
    });
    assert.equal(resposta.statusCode, 200);
    assert.equal((await app.inject({
      method: 'POST', url: '/api/auth/redefinir-senha', payload,
    })).statusCode, 400, 'reutilização do link deve falhar');

    await assert.rejects(renovarTokens(sessaoAntiga.refreshToken),
      /Sessão expirada ou revogada/);
    assert.equal((await app.inject({
      method: 'GET', url: '/api/usuarios/mim',
      headers: { authorization: `Bearer ${sessaoAntiga.accessToken}` },
    })).statusCode, 401, 'access token antigo também deve ser invalidado imediatamente');
    assert.equal((await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email, senha: senhaOriginal },
    })).statusCode, 401);
    const loginNovo = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email, senha: senhaNova },
    });
    assert.equal(loginNovo.statusCode, 200);
    const cookieNovo = cookieSessao(loginNovo);
    await app.inject({ method: 'POST', url: '/api/auth/logout',
      headers: { cookie: cookieNovo, authorization: `Bearer ${(loginNovo.json() as { accessToken: string }).accessToken}` } });
  });
});
