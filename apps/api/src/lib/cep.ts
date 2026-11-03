import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from './prisma.js';

class CepInvalidoError extends Error {}

interface RespostaViaCep {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge?: string;
  erro?: boolean;
}

interface ResultadoNominatim {
  lat: string;
  lon: string;
}

function normalizarNomeCidade(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

interface MunicipioBase {
  codigo_ibge: number;
  codigo_uf: number;
  nome: string;
  latitude: number;
  longitude: number;
}

interface EstadoBase {
  codigo_uf: number;
  uf: string;
}

interface LocalizacaoMunicipio {
  lat: number;
  lng: number;
}

let baseMunicipiosCarregada = false;
const municipiosPorIbge = new Map<string, LocalizacaoMunicipio>();
const municipiosPorNomeUf = new Map<string, LocalizacaoMunicipio>();

// A base nacional ja pertence ao projeto (prisma/seed/data). Evita depender
// de um seed manual sempre que o banco e migrado para um novo provedor.
function obterMunicipioDaBase(
  nome: string,
  uf: string,
  codigoIbge?: string,
): LocalizacaoMunicipio | null {
  if (!baseMunicipiosCarregada) {
    baseMunicipiosCarregada = true;
    try {
      const diretorio = join(process.cwd(), 'prisma', 'seed', 'data');
      const lerJson = (arquivo: string) =>
        JSON.parse(readFileSync(join(diretorio, arquivo), 'utf8').replace(/^\uFEFF/, ''));

      const estados = lerJson('estados.json') as EstadoBase[];
      const municipios = lerJson('municipios.json') as MunicipioBase[];
      const ufs = new Map(estados.map((estado) => [estado.codigo_uf, estado.uf]));

      for (const municipio of municipios) {
        const ufMunicipio = ufs.get(municipio.codigo_uf);
        if (!ufMunicipio) continue;

        const localizacao = { lat: municipio.latitude, lng: municipio.longitude };
        if (!Number.isFinite(localizacao.lat) || !Number.isFinite(localizacao.lng)) continue;

        municipiosPorIbge.set(String(municipio.codigo_ibge), localizacao);
        municipiosPorNomeUf.set(
          `${ufMunicipio}:${normalizarNomeCidade(municipio.nome)}`,
          localizacao,
        );
      }
    } catch (erro) {
      // Se a distribuicao nao contiver os arquivos de seed, ainda e possivel
      // localizar o municipio pelo geocodificador ja utilizado pelo projeto.
      console.error('[cep] Nao foi possivel carregar a base nacional de municipios', erro);
    }
  }

  return (
    (codigoIbge ? municipiosPorIbge.get(codigoIbge) : undefined) ??
    municipiosPorNomeUf.get(`${uf}:${normalizarNomeCidade(nome)}`) ??
    null
  );
}

function slugDaCidade(nome: string, uf: string): string {
  const nomeSlug = normalizarNomeCidade(nome)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${nomeSlug}-${uf.toLowerCase()}`;
}

let ultimaChamadaNominatim = 0;
const INTERVALO_MINIMO_MS = 1100;

async function aguardarLimiteNominatim() {
  const agora = Date.now();
  const decorrido = agora - ultimaChamadaNominatim;
  if (decorrido < INTERVALO_MINIMO_MS) {
    await new Promise((resolve) => setTimeout(resolve, INTERVALO_MINIMO_MS - decorrido));
  }
  ultimaChamadaNominatim = Date.now();
}

async function consultarNominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    await aguardarLimiteNominatim();

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
    const resposta = await fetch(url, {
      headers: { 'User-Agent': 'LartopApp/1.0 (contato@lartop.dev)' },
    });

    if (!resposta.ok) return null;

    const resultados = (await resposta.json()) as ResultadoNominatim[];
    if (resultados.length === 0) return null;

    return { lat: parseFloat(resultados[0].lat), lng: parseFloat(resultados[0].lon) };
  } catch {
    return null;
  }
}

async function geocodificarEndereco(dados: RespostaViaCep): Promise<{ lat: number; lng: number } | null> {
  if (dados.logradouro) {
    const queryCompleta = [dados.logradouro, dados.bairro, dados.localidade, dados.uf, 'Brasil']
      .filter(Boolean)
      .join(', ');
    const resultado = await consultarNominatim(queryCompleta);
    if (resultado) return resultado;
  }

  if (dados.bairro) {
    const queryBairro = [dados.bairro, dados.localidade, dados.uf, 'Brasil'].filter(Boolean).join(', ');
    const resultado = await consultarNominatim(queryBairro);
    if (resultado) return resultado;
  }

  return null;
}

export async function resolverCep(cepBruto: string) {
  const cep = cepBruto.replace(/\D/g, '');
  if (cep.length !== 8) {
    throw new CepInvalidoError('CEP deve ter 8 digitos');
  }

  const cepExistente = await prisma.cep.findUnique({
    where: { cep },
    include: { cidade: true },
  });
  if (cepExistente) {
    return cepExistente;
  }

  const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!resposta.ok) {
    throw new CepInvalidoError('Nao foi possivel consultar o CEP no momento');
  }

  const dados = (await resposta.json()) as RespostaViaCep;
  if (dados.erro) {
    throw new CepInvalidoError('CEP nao existe');
  }

  if (!dados.localidade || !dados.uf) {
    throw new CepInvalidoError('Nao foi possivel identificar a cidade deste CEP');
  }

  const nomeNormalizado = normalizarNomeCidade(dados.localidade);
  const cidadesDoEstado = await prisma.cidade.findMany({ where: { estado: dados.uf } });
  let cidade = cidadesDoEstado.find((c) => normalizarNomeCidade(c.nome) === nomeNormalizado);

  if (!cidade) {
    // Em um banco novo, a tabela de municipios pode estar vazia.
    // Cria somente a cidade consultada, de forma idempotente e com dados
    // da base nacional do repositorio (incluindo as coordenadas do IBGE).
    const coordenadasDaCidade =
      obterMunicipioDaBase(dados.localidade, dados.uf, dados.ibge) ??
      (await consultarNominatim(`${dados.localidade}, ${dados.uf}, Brasil`));

    if (!coordenadasDaCidade) {
      throw new CepInvalidoError(
        'Nao foi possivel localizar este municipio no momento. Tente novamente.'
      );
    }

    cidade = await prisma.cidade.upsert({
      where: { slug: slugDaCidade(dados.localidade, dados.uf) },
      create: {
        nome: dados.localidade,
        estado: dados.uf,
        slug: slugDaCidade(dados.localidade, dados.uf),
        lat: coordenadasDaCidade.lat,
        lng: coordenadasDaCidade.lng,
      },
      update: {},
    });
  }

  const coordenadaPrecisa = await geocodificarEndereco(dados);
  const lat = coordenadaPrecisa?.lat ?? cidade.lat;
  const lng = coordenadaPrecisa?.lng ?? cidade.lng;

  const novoCep = await prisma.cep.upsert({
    where: { cep },
    update: {},
    create: { cep, cidadeId: cidade.id, lat, lng },
    include: { cidade: true },
  });

  return novoCep;
}

export { CepInvalidoError };
