import { prisma } from './prisma.js';

class CepInvalidoError extends Error {}

interface RespostaViaCep {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
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

  const nomeNormalizado = normalizarNomeCidade(dados.localidade);
  const cidadesDoEstado = await prisma.cidade.findMany({ where: { estado: dados.uf } });
  const cidade = cidadesDoEstado.find((c) => normalizarNomeCidade(c.nome) === nomeNormalizado);

  if (!cidade) {
    throw new CepInvalidoError(
      `Cidade "${dados.localidade}/${dados.uf}" nao encontrada na base de municipios`
    );
  }

  const coordenadaPrecisa = await geocodificarEndereco(dados);

  const lat = coordenadaPrecisa?.lat ?? cidade.lat;
  const lng = coordenadaPrecisa?.lng ?? cidade.lng;

  const novoCep = await prisma.cep.create({
    data: { cep, cidadeId: cidade.id, lat, lng },
    include: { cidade: true },
  });

  return novoCep;
}

export { CepInvalidoError };
