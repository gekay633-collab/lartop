import { prisma } from '../../lib/prisma.js';
import { imagemPertenceAoUsuario } from '../../lib/imagem-segura.js';
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
  if (input.fotoPerfilUrl && !imagemPertenceAoUsuario(input.fotoPerfilUrl, usuarioId)) {
    throw new PerfilError('A foto do perfil deve ter sido enviada pela sua conta.', 400);
  }
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

// Cada registro representa uma foto independente. A coluna url_depois
// permanece no banco somente para compatibilidade com dados históricos.
// O limite é aplicado no banco, nunca apenas na interface.
export const LIMITE_PUBLICACOES_PORTFOLIO = 6;

export async function adicionarFotoPortfolio(usuarioId: string, input: AdicionarFotoPortfolioInput) {
  if (!imagemPertenceAoUsuario(input.url, usuarioId)) {
    throw new PerfilError('A foto deve ter sido enviada pela sua conta.', 400);
  }

  // Bloquear a linha do perfil serializa adições simultâneas da mesma conta.
  // Sem o lock, duas requisições podem observar 5 trabalhos e criar o 7º.
  return prisma.$transaction(async (tx) => {
    const perfil = await tx.$queryRaw<{ usuario_id: string }[]>`
      SELECT usuario_id FROM perfis_profissionais
      WHERE usuario_id = ${usuarioId} FOR UPDATE
    `;
    if (!perfil.length) {
      throw new PerfilError('Perfil profissional não encontrado', 404);
    }
    const total = await tx.fotoPortfolio.count({ where: { profissionalId: usuarioId } });
    if (total >= LIMITE_PUBLICACOES_PORTFOLIO) {
      throw new PerfilError('Você já publicou 6 fotos. Exclua uma para adicionar outra.', 409);
    }

    return tx.fotoPortfolio.create({
      data: {
        profissionalId: usuarioId,
        urlDepois: input.url,
        descricao: input.descricao,
      },
    });
  });
}

/** Remove somente uma foto pertencente ao profissional autenticado.
 * A mídia existente não é removida do Cloudinary nesta etapa para evitar
 * exclusão física acidental de arquivos que possam estar referenciados.
 */
export async function excluirFotoPortfolio(usuarioId: string, fotoId: string) {
  const excluidas = await prisma.fotoPortfolio.deleteMany({
    where: { id: fotoId, profissionalId: usuarioId },
  });
  if (excluidas.count !== 1) {
    // Mesma resposta para ID inexistente e publicação de outra pessoa.
    throw new PerfilError('Foto não encontrada no seu portfólio.', 404);
  }
  return { ok: true };
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
  // Nunca retornar o modelo completo. CEP-base, coordenadas exatas, plano,
  // flags internas e dados de conta são privados, mesmo se o perfil é público.
  const perfil = await prisma.perfilProfissional.findFirst({
    where: { usuarioId, perfilPublicado: true, usuario: { ativo: true } },
    select: {
      usuarioId: true,
      nomeExibicao: true,
      bio: true,
      fotoPerfilUrl: true,
      raioAtendimentoKm: true,
      seloVerificado: true,
      notaMedia: true,
      totalAvaliacoes: true,
      cidade: { select: { id: true, nome: true, estado: true } },
      categorias: {
        select: {
          id: true,
          valorReferencia: true,
          categoria: { select: { id: true, nome: true, slug: true } },
        },
      },
      fotos: {
        orderBy: { criadoEm: 'desc' },
        select: { id: true, urlDepois: true, descricao: true },
      },
    },
  });

  if (!perfil) {
    throw new PerfilError('Perfil não encontrado');
  }

  return perfil;
}
