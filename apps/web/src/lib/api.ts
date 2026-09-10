const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

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

export async function buscarProfissionais(params: {
  cep: string;
  categoria?: string;
  raioKm?: number;
}): Promise<RespostaBusca | ErroApi> {
  const query = new URLSearchParams({ cep: params.cep });
  if (params.categoria) query.set("categoria", params.categoria);
  if (params.raioKm) query.set("raioKm", String(params.raioKm));

  const resposta = await fetch(`${API_URL}/api/profissionais/buscar?${query.toString()}`, {
    cache: "no-store",
  });

  const dados = await resposta.json();
  return dados;
}

export function ehErroApi(dados: RespostaBusca | ErroApi): dados is ErroApi {
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
  const API_URL_LOCAL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const resposta = await fetch(`${API_URL_LOCAL}/api/profissionais/${id}`, { cache: "no-store" });
  return resposta.json();
}

export async function listarAvaliacoes(id: string): Promise<Avaliacao[]> {
  const API_URL_LOCAL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const resposta = await fetch(`${API_URL_LOCAL}/api/profissionais/${id}/avaliacoes`, { cache: "no-store" });
  if (!resposta.ok) return [];
  return resposta.json();
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
  const API_URL_LOCAL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const query = new URLSearchParams();
  if (params.categoria) query.set("categoria", params.categoria);

  const resposta = await fetch(
    `${API_URL_LOCAL}/api/cidades/${params.estado}/${params.cidadeSlug}/profissionais?${query.toString()}`,
    { cache: "no-store" }
  );
  return resposta.json();
}
