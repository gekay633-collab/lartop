import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { resolverCep, CepInvalidoError } from '../../lib/cep.js';
import type { BuscarProfissionaisInput } from './busca.schemas.js';

const CACHE_TTL_SEGUNDOS = 60;

class BuscaError extends Error {}

interface ProfissionalResultado {
  usuarioId: string;
  nomeExibicao: string;
  bio: string | null;
  fotoPerfilUrl: string | null;
  notaMedia: number;
  totalAvaliacoes: number;
  seloVerificado: boolean;
  cidadeId: string;
  cidadeNome: string;
  cidadeEstado: string;
  distanciaKm: number;
}

async function executarBuscaPorCoordenadas(params: {
  lat: number;
  lng: number;
  categoria?: string;
  raioKm: number;
  pagina: number;
  porPagina: number;
}) {
  const offset = (params.pagina - 1) * params.porPagina;

  const filtroCategoria = params.categoria
    ? `AND EXISTS (
        SELECT 1 FROM profissional_categorias pc
        JOIN categorias c ON c.id = pc.categoria_id
        WHERE pc.profissional_id = pp.usuario_id AND c.slug = $4
      )`
    : '';

  const paramsSql: (string | number)[] = [params.lat, params.lng, params.raioKm];
  if (params.categoria) paramsSql.push(params.categoria);
  paramsSql.push(params.porPagina, offset);

  const limitParamIndex = paramsSql.length - 1;
  const offsetParamIndex = paramsSql.length;

  const query = `
    WITH base AS (
      SELECT
        pp.usuario_id AS "usuarioId",
        pp.nome_exibicao AS "nomeExibicao",
        pp.bio,
        pp.foto_perfil_url AS "fotoPerfilUrl",
        pp.nota_media AS "notaMedia",
        pp.total_avaliacoes AS "totalAvaliacoes",
        pp.selo_verificado AS "seloVerificado",
        cid.id AS "cidadeId",
        cid.nome AS "cidadeNome",
        cid.estado AS "cidadeEstado",
        (
          6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians($1)) * cos(radians(pp.lat)) * cos(radians(pp.lng) - radians($2))
              + sin(radians($1)) * sin(radians(pp.lat))
            ))
          )
        ) AS "distanciaKm"
      FROM perfis_profissionais pp
      JOIN cidades cid ON cid.id = pp.cidade_id
      WHERE pp.perfil_publicado = true
      ${filtroCategoria}
    )
    SELECT * FROM base
    WHERE "distanciaKm" <= $3
    ORDER BY "distanciaKm" ASC
    LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;

  const resultados = await prisma.$queryRawUnsafe<ProfissionalResultado[]>(query, ...paramsSql);

  return resultados.map((r) => ({ ...r, distanciaKm: Number(r.distanciaKm.toFixed(1)) }));
}

export async function buscarProfissionaisPorCep(input: BuscarProfissionaisInput) {
  let cep;
  try {
    cep = await resolverCep(input.cep);
  } catch (err) {
    if (err instanceof CepInvalidoError) {
      throw new BuscaError(err.message);
    }
    throw err;
  }

  const chaveCache = `busca:${input.cep}:${input.categoria ?? 'todas'}:${input.raioKm}:${input.pagina}:${input.porPagina}`;
  const cacheado = await redis.get(chaveCache);
  if (cacheado) {
    return JSON.parse(cacheado);
  }

  const resultados = await executarBuscaPorCoordenadas({
    lat: cep.lat,
    lng: cep.lng,
    categoria: input.categoria,
    raioKm: input.raioKm,
    pagina: input.pagina,
    porPagina: input.porPagina,
  });

  const resposta = {
    cepBuscado: input.cep,
    cidadeId: cep.cidadeId,
    raioKm: input.raioKm,
    pagina: input.pagina,
    porPagina: input.porPagina,
    total: resultados.length,
    resultados,
  };

  await redis.set(chaveCache, JSON.stringify(resposta), 'EX', CACHE_TTL_SEGUNDOS);

  return resposta;
}

export async function buscarProfissionaisPorCidadeSlug(params: {
  estado: string;
  cidadeSlug: string;
  categoria?: string;
  raioKm?: number;
  pagina?: number;
  porPagina?: number;
}) {
  const slugCompleto = `${params.cidadeSlug}-${params.estado.toLowerCase()}`;

  const cidade = await prisma.cidade.findUnique({ where: { slug: slugCompleto } });
  if (!cidade) {
    throw new BuscaError('Cidade nao encontrada');
  }

  const raioKm = params.raioKm ?? 15;
  const pagina = params.pagina ?? 1;
  const porPagina = params.porPagina ?? 20;

  const chaveCache = `busca-cidade:${slugCompleto}:${params.categoria ?? 'todas'}:${raioKm}:${pagina}:${porPagina}`;
  const cacheado = await redis.get(chaveCache);
  if (cacheado) {
    return JSON.parse(cacheado);
  }

  const resultados = await executarBuscaPorCoordenadas({
    lat: cidade.lat,
    lng: cidade.lng,
    categoria: params.categoria,
    raioKm,
    pagina,
    porPagina,
  });

  const resposta = {
    cidade: { id: cidade.id, nome: cidade.nome, estado: cidade.estado, slug: cidade.slug },
    raioKm,
    pagina,
    porPagina,
    total: resultados.length,
    resultados,
  };

  await redis.set(chaveCache, JSON.stringify(resposta), 'EX', CACHE_TTL_SEGUNDOS);

  return resposta;
}

export { BuscaError };
