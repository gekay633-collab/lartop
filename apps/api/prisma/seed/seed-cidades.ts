import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

interface Estado {
  codigo_uf: number;
  uf: string;
  nome: string;
}

interface Municipio {
  codigo_ibge: number;
  nome: string;
  latitude: number;
  longitude: number;
  codigo_uf: number;
}

function lerJsonSemBom(caminho: string) {
  const conteudo = readFileSync(caminho, 'utf-8').replace(/^\uFEFF/, '');
  return JSON.parse(conteudo);
}

function gerarSlug(nome: string, uf: string): string {
  const nomeSlug = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${nomeSlug}-${uf.toLowerCase()}`;
}

async function main() {
  const estados: Estado[] = lerJsonSemBom(join(__dirname, 'data', 'estados.json'));
  const municipios: Municipio[] = lerJsonSemBom(join(__dirname, 'data', 'municipios.json'));

  const mapaUf = new Map(estados.map((e) => [e.codigo_uf, e.uf]));

  console.log(`Seed nacional: ${municipios.length} municipios encontrados no arquivo.`);

  const lote = 500;
  let processados = 0;

  for (let i = 0; i < municipios.length; i += lote) {
    const pedaco = municipios.slice(i, i + lote);

    await prisma.$transaction(
      pedaco.map((m) => {
        const uf = mapaUf.get(m.codigo_uf);
        if (!uf) {
          throw new Error(`UF nao encontrada para codigo_uf ${m.codigo_uf} (municipio ${m.nome})`);
        }
        const slug = gerarSlug(m.nome, uf);

        return prisma.cidade.upsert({
          where: { slug },
          update: {
            nome: m.nome,
            estado: uf,
            lat: m.latitude,
            lng: m.longitude,
          },
          create: {
            nome: m.nome,
            estado: uf,
            slug,
            lat: m.latitude,
            lng: m.longitude,
          },
        });
      })
    );

    processados += pedaco.length;
    console.log(`Processados ${processados}/${municipios.length}...`);
  }

  const total = await prisma.cidade.count();
  console.log(`Seed nacional concluido! Total de cidades no banco: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
