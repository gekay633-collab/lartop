import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] ?? 'admin@lartop.dev';
  const senha = process.argv[3] ?? 'admin12345';

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log('Admin ja existe:', email);
    return;
  }

  const senhaHash = await argon2.hash(senha, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

  const admin = await prisma.usuario.create({
    data: { nome: 'Admin Lartop', email, senhaHash, tipo: 'ADMIN' },
  });

  console.log('Admin criado:', admin.email, '| senha:', senha);
}

main().finally(() => prisma.$disconnect());
