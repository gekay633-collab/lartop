import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import type {
  AtualizarPerfilInput,
  DefinirCategoriasInput,
  AdicionarFotoPortfolioInput,
} from './perfil.schemas.js';

class PerfilError extends Error {
  constructor(message: string, public readonly status: number = 404) {
    super(message);
  }
}

const MINIMO_CAMPOS_PARA_PUBLICAR = ['nomeExibicao', 'bio'] as const;

export async function obterPerfilProprio(usuarioId: string) {
  const perfil = await prisma.perfilProfissional.findUnique({
    where: { usuarioId },
    include: {
      cidade: true,
      categorias: { include: { categoria: true } },
      fotos: true,
      usuario: { select: { telefone: true, telefoneVerificado: true } },
    },
  });

  if (!perfil) {
    throw new PerfilError('Perfil profissional não encontrado');
  }

  return perfil;
}

export async function atualizarPerfil(usuarioId: string, input: AtualizarPerfilInput) {
  const perfilExistente = await prisma.perfilProfissional.findUnique({ where: { usuarioId } });
  if (!perfilExistente) {
    throw new PerfilError('Perfil profissional não encontrado');
  }

  const perfilAtualizado = await prisma.perfilProfissional.update({
    where: { usuarioId },
    data: input,
  });

  await invalidarCachePerfil(usuarioId);

  return perfilAtualizado;
}

export async function atualizarTelefoneProfissional(usuarioId: string, telefone: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { telefone: true, telefoneVerificado: true, tipo: true },
  });
  if (!usuario || usuario.tipo !== 'PROFISSIONAL') {
    throw new PerfilError('Conta profissional não encontrada', 404);
  }

  // Uma edição sem mudança de número não revoga a verificação existente.
  if (usuario.telefone?.replace(/\D/g, '') === telefone) {
    return { telefone: usuario.telefone, telefoneVerificado: usuario.telefoneVerificado };
  }

  // O novo número passa a ser usado nas próximas solicitações do WhatsApp.
  // Ele não é considerado verificado até uma validação de posse separada.
  return prisma.usuario.update({
    where: { id: usuarioId },
    data: { telefone, telefoneVerificado: false },
    select: { telefone: true, telefoneVerificado: true },
  });
}

export async function definirCategorias(usuarioId: string, input: DefinirCategoriasInput) {
  const perfilExistente = await prisma.perfilProfissional.findUnique({ where: { usuarioId } });
  if (!perfilExistente) {
    throw new PerfilError('Perfil profissional não encontrado');
  }

  // Apenas categorias existentes e ativas podem ser associadas ao prestador.
  const ids = input.categorias.map((categoria) => categoria.categoriaId);
  const categoriasAtivas = await prisma.categoria.count({
    where: { id: { in: ids }, ativo: true },
  });
  if (categoriasAtivas !== ids.length) {
    throw new PerfilError('Escolha apenas serviços ativos cadastrados pela Lartop', 400);
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.profissionalCategoria.deleteMany({ where: { profissionalId: usuarioId } });
    await tx.profissionalCategoria.createMany({
      data: input.categorias.map((c) => ({
        profissionalId: usuarioId,
        categoriaId: c.categoriaId,
        valorReferencia: c.valorReferencia,
      })),
    });
  });

  await invalidarCachePerfil(usuarioId);

  return obterPerfilProprio(usuarioId);
}

export async function adicionarFotoPortfolio(usuarioId: string, input: AdicionarFotoPortfolioInput) {
  const perfilExistente = await prisma.perfilProfissional.findUnique({ where: { usuarioId } });
  if (!perfilExistente) {
    throw new PerfilError('Perfil profissional não encontrado');
  }

  const foto = await prisma.fotoPortfolio.create({
    data: {
      profissionalId: usuarioId,
      urlAntes: input.urlAntes,
      urlDepois: input.urlDepois,
      descricao: input.descricao,
    },
  });

  return foto;
}

export async function publicarPerfil(usuarioId: string) {
  const perfil = await prisma.perfilProfissional.findUnique({
    where: { usuarioId },
    include: { categorias: true },
  });

  if (!perfil) {
    throw new PerfilError('Perfil profissional não encontrado');
  }

  if (!perfil.bio || perfil.categorias.length === 0) {
    throw new PerfilError('Preencha bio e ao menos uma categoria antes de publicar');
  }

  const perfilPublicado = await prisma.perfilProfissional.update({
    where: { usuarioId },
    data: { perfilPublicado: true },
  });

  await invalidarCachePerfil(usuarioId);

  return perfilPublicado;
}

export async function despublicarPerfil(usuarioId: string) {
  const perfilPublicado = await prisma.perfilProfissional.update({
    where: { usuarioId },
    data: { perfilPublicado: false },
  });

  await invalidarCachePerfil(usuarioId);

  return perfilPublicado;
}

async function invalidarCachePerfil(usuarioId: string) {
  const chaves = await redis.keys('busca:*');
  if (chaves.length > 0) {
    await redis.del(...chaves);
  }
}

export { PerfilError };

export async function obterPerfilPublico(usuarioId: string) {
  const perfil = await prisma.perfilProfissional.findUnique({
    where: { usuarioId, perfilPublicado: true },
    include: {
      cidade: true,
      categorias: { include: { categoria: true } },
      fotos: { orderBy: { criadoEm: 'desc' } },
    },
  });

  if (!perfil) {
    throw new PerfilError('Perfil não encontrado');
  }

  return perfil;
}
