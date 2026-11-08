import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

/**
 * Bootstrap excepcional de administrador. Não manter credenciais padrão,
 * não receber senha por argumentos (ficam no histórico/na lista de processos)
 * e nunca imprimi-la nos logs.
 *
 * LARTOP_ADMIN_EMAIL=... LARTOP_ADMIN_PASSWORD=... node scripts-criar-admin.mjs
 * Em produção também exige LARTOP_PERMITIR_CRIAR_ADMIN=true (uso único).
 */
const prisma = new PrismaClient();

async function main() {
  const email = process.env.LARTOP_ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.LARTOP_ADMIN_PASSWORD;

  if (process.argv.length > 2) {
    throw new Error('Use variáveis de ambiente em vez de argumentos da linha de comando.');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !senha || senha.length < 16 || senha.length > 128) {
    throw new Error('Defina LARTOP_ADMIN_EMAIL e uma LARTOP_ADMIN_PASSWORD forte (16 a 128 caracteres).');
  }
  if (process.env.NODE_ENV === 'production' &&
      process.env.LARTOP_PERMITIR_CRIAR_ADMIN !== 'true') {
    throw new Error('Criação administrativa em produção bloqueada. Exige autorização explícita.');
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    throw new Error('Já existe uma conta com esse e-mail. Nenhuma alteração foi realizada.');
  }

  const senhaHash = await argon2.hash(senha, {
    type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
  });
  await prisma.usuario.create({
    data: { nome: 'Administrador Lartop', email, senhaHash, tipo: 'ADMIN' },
  });
  console.info('Conta administrativa criada. Guarde a senha no gerenciador de segredos.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : 'Falha ao cadastrar administrador');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
