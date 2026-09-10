import 'dotenv/config';
import Fastify from 'fastify';
import { registrarSeguranca } from './plugins/seguranca.js';
import autenticacaoPlugin from './plugins/autenticacao.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { buscaRoutes } from './modules/busca/busca.routes.js';
import { perfilRoutes } from './modules/perfil/perfil.routes.js';
import { solicitacaoRoutes } from './modules/solicitacao/solicitacao.routes.js';
import { avaliacaoRoutes } from './modules/avaliacao/avaliacao.routes.js';
import { usuarioRoutes } from './modules/usuario/usuario.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { eventoRoutes } from './modules/evento/evento.routes.js';
import { categoriaRoutes } from './modules/categoria/categoria.routes.js';
import { uploadRoutes } from './modules/upload/upload.routes.js';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : { target: 'pino-pretty', options: { colorize: true } },
  },
});

async function bootstrap() {
  await registrarSeguranca(app);
  await app.register(autenticacaoPlugin);

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: '/api' });
  await app.register(buscaRoutes, { prefix: '/api' });
  await app.register(perfilRoutes, { prefix: '/api' });
  await app.register(solicitacaoRoutes, { prefix: '/api' });
  await app.register(avaliacaoRoutes, { prefix: '/api' });
  await app.register(usuarioRoutes, { prefix: '/api' });
  await app.register(adminRoutes, { prefix: '/api' });
  await app.register(eventoRoutes, { prefix: '/api' });
  await app.register(categoriaRoutes, { prefix: '/api' });
  await app.register(uploadRoutes, { prefix: '/api' });

  const port = Number(process.env.PORT ?? 3333);
  await app.listen({ port, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
