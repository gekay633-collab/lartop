import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const cidades = [
  { nome: 'São Paulo', estado: 'SP', slug: 'sao-paulo-sp', lat: -23.5505, lng: -46.6333, cepAmostra: '01001000' },
  { nome: 'Rio de Janeiro', estado: 'RJ', slug: 'rio-de-janeiro-rj', lat: -22.9068, lng: -43.1729, cepAmostra: '20010000' },
  { nome: 'Belo Horizonte', estado: 'MG', slug: 'belo-horizonte-mg', lat: -19.9167, lng: -43.9345, cepAmostra: '30110000' },
  { nome: 'Curitiba', estado: 'PR', slug: 'curitiba-pr', lat: -25.4284, lng: -49.2733, cepAmostra: '80010000' },
  { nome: 'Porto Alegre', estado: 'RS', slug: 'porto-alegre-rs', lat: -30.0346, lng: -51.2177, cepAmostra: '90010000' },
  { nome: 'Salvador', estado: 'BA', slug: 'salvador-ba', lat: -12.9777, lng: -38.5016, cepAmostra: '40010000' },
  { nome: 'Brasília', estado: 'DF', slug: 'brasilia-df', lat: -15.7939, lng: -47.8828, cepAmostra: '70040000' },
  { nome: 'Recife', estado: 'PE', slug: 'recife-pe', lat: -8.0476, lng: -34.8770, cepAmostra: '50010000' },
  { nome: 'Fortaleza', estado: 'CE', slug: 'fortaleza-ce', lat: -3.7172, lng: -38.5433, cepAmostra: '60010000' },
  { nome: 'Campinas', estado: 'SP', slug: 'campinas-sp', lat: -22.9099, lng: -47.0626, cepAmostra: '13010000' },
];

const categorias = [
  { nome: 'Corte de grama', slug: 'corte-de-grama' },
  { nome: 'Poda de árvores e arbustos', slug: 'poda' },
  { nome: 'Paisagismo', slug: 'paisagismo' },
  { nome: 'Manutenção de jardim', slug: 'manutencao-jardim' },
  { nome: 'Limpeza de terreno', slug: 'limpeza-terreno' },
  { nome: 'Instalação de grama/jardim', slug: 'instalacao' },
];

async function main() {
  console.log('Seed: criando categorias...');
  for (const cat of categorias) {
    await prisma.categoria.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log('Seed: criando cidades e CEP amostra...');
  for (const c of cidades) {
    const cidade = await prisma.cidade.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        nome: c.nome,
        estado: c.estado,
        slug: c.slug,
        lat: c.lat,
        lng: c.lng,
      },
    });

    await prisma.cep.upsert({
      where: { cep: c.cepAmostra },
      update: {},
      create: {
        cep: c.cepAmostra,
        cidadeId: cidade.id,
        lat: c.lat,
        lng: c.lng,
      },
    });
  }

  console.log('Seed concluido!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
