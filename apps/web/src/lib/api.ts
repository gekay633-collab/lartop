// Apenas chamadas no servidor: no navegador, use /api/* (mesma origem).
const BACKEND_PADRAO =
  process.env.NODE_ENV === "production"
    ? "https://lartop-production.up.railway.app"
    : "http://localhost:3333";
const API_URL = (process.env.API_BACKEND_URL?.trim() || BACKEND_PADRAO).replace(/\/+$/, "");

export interface ProfissionalResultado {
  usuarioId: string;
  nomeExibicao: string;
  bio: string | null;
  fotoPerfilUrl: string | null;
  notaMedia: number;
  totalAvaliacoes: number;
  seloVerificado: boolean;
  cidadeNome: string;
  cidadeEstado: string;
  distanciaKm: number;
}

export interface RespostaBusca {
  cepBuscado: string;
  cidadeId: string;
  raioKm: number;
  pagina: number;
  porPagina: number;
  total: number;
  resultados: ProfissionalResultado[];
}

export interface ErroApi {
  erro: string;
}

const MENSAGEM_API_INDISPONIVEL =
  "Não foi possível consultar os profissionais agora. Tente novamente em instantes.";

async function consultarApi<T extends object>(caminho: string): Promise<T | ErroApi> {
  try {
    const resposta = await fetch(`${API_URL}${caminho}`, { cache: "no-store" });
    const tipoConteudo = resposta.headers.get("content-type") ?? "";

    if (!tipoConteudo.includes("application/json")) {
      console.error("[api] Resposta não JSON:", caminho.split("?")[0], resposta.status);
      return { erro: MENSAGEM_API_INDISPONIVEL };
    }

    const dados: unknown = await resposta.json();

    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      console.error("[api] Resposta JSON inválida:", caminho.split("?")[0]);
      return { erro: MENSAGEM_API_INDISPONIVEL };
    }

    if (!resposta.ok) {
      const mensagem = "erro" in dados && typeof dados.erro === "string"
        ? dados.erro
        : MENSAGEM_API_INDISPONIVEL;
      return { erro: mensagem };
    }

    return dados as T;
  } catch (erro) {
    console.error("[api] Falha de conexão:", caminho.split("?")[0], erro);
    return { erro: MENSAGEM_API_INDISPONIVEL };
  }
}

export async function buscarProfissionais(params: {
  cep: string;
  categoria?: string;
  raioKm?: number;
}): Promise<RespostaBusca | ErroApi> {
  const query = new URLSearchParams({ cep: params.cep });
  if (params.categoria) query.set("categoria", params.categoria);
  if (params.raioKm) query.set("raioKm", String(params.raioKm));

  const dados = await consultarApi<RespostaBusca>(`/api/profissionais/buscar?${query.toString()}`);
  if (ehErroApi(dados)) return dados;

  if (!Array.isArray(dados.resultados) || typeof dados.cidadeId !== "string") {
    console.error("[api] Estrutura inesperada na busca por CEP");
    return { erro: MENSAGEM_API_INDISPONIVEL };
  }

  return dados;
}

export function ehErroApi<T extends object>(dados: T | ErroApi): dados is ErroApi {
  return "erro" in dados;
}

export interface FotoPortfolio {
  id: string;
  urlAntes: string | null;
  urlDepois: string;
  descricao: string | null;
}

export interface CategoriaProfissional {
  id: string;
  valorReferencia: number | null;
  categoria: { id: string; nome: string; slug: string };
}

export interface PerfilPublico {
  usuarioId: string;
  nomeExibicao: string;
  bio: string | null;
  fotoPerfilUrl: string | null;
  raioAtendimentoKm: number;
  seloVerificado: boolean;
  notaMedia: number;
  totalAvaliacoes: number;
  cidade: { id: string; nome: string; estado: string };
  categorias: CategoriaProfissional[];
  fotos: FotoPortfolio[];
}

export interface Avaliacao {
  id: string;
  nota: number;
  comentario: string | null;
  criadoEm: string;
  avaliador: { nome: string };
}

export async function obterPerfilPublico(id: string): Promise<PerfilPublico | ErroApi> {
  const perfil = await consultarApi<PerfilPublico>(`/api/profissionais/${encodeURIComponent(id)}`);
  if (ehErroApi(perfil)) return perfil;

  if (!perfil.cidade || !Array.isArray(perfil.categorias) || !Array.isArray(perfil.fotos)) {
    console.error("[api] Estrutura inesperada no perfil público");
    return { erro: MENSAGEM_API_INDISPONIVEL };
  }

  return perfil;
}

export async function listarAvaliacoes(id: string): Promise<Avaliacao[]> {
  try {
    const resposta = await fetch(
      `${API_URL}/api/profissionais/${encodeURIComponent(id)}/avaliacoes`,
      { cache: "no-store" }
    );
    if (!resposta.ok) return [];

    const dados: unknown = await resposta.json();
    return Array.isArray(dados) ? (dados as Avaliacao[]) : [];
  } catch (erro) {
    console.error("[api] Falha ao consultar avaliações:", erro);
    return [];
  }
}

export interface RespostaBuscaCidade {
  cidade: { nome: string; estado: string; slug: string };
  raioKm: number;
  pagina: number;
  porPagina: number;
  total: number;
  resultados: ProfissionalResultado[];
}

export async function buscarProfissionaisPorCidade(params: {
  estado: string;
  cidadeSlug: string;
  categoria?: string;
}): Promise<RespostaBuscaCidade | ErroApi> {
  const query = new URLSearchParams();
  if (params.categoria) query.set("categoria", params.categoria);

  const resultado = await consultarApi<RespostaBuscaCidade>(
    `/api/cidades/${encodeURIComponent(params.estado)}/${encodeURIComponent(params.cidadeSlug)}/profissionais?${query.toString()}`
  );
  if (ehErroApi(resultado)) return resultado;

  if (
    !resultado.cidade ||
    typeof resultado.cidade.nome !== "string" ||
    !Array.isArray(resultado.resultados)
  ) {
    console.error("[api] Estrutura inesperada na busca por cidade");
    return { erro: MENSAGEM_API_INDISPONIVEL };
  }

  return resultado;
}
