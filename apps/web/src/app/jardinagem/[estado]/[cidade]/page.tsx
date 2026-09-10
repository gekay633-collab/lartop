import type { Metadata } from "next";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { CardProfissional } from "@/components/CardProfissional";
import { BuscaHero } from "@/components/BuscaHero";
import { buscarProfissionaisPorCidade, ehErroApi } from "@/lib/api";

interface PageProps {
  params: Promise<{ estado: string; cidade: string }>;
}

function nomeCidadeLegivel(slug: string): string {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { estado, cidade } = await params;
  const nomeCidade = nomeCidadeLegivel(cidade);
  const uf = estado.toUpperCase();

  return {
    title: `Jardineiros e cortadores de grama em ${nomeCidade}, ${uf} | Lartop`,
    description: `Encontre profissionais de corte de grama, poda e paisagismo em ${nomeCidade}/${uf}. Compare avaliacoes e fale direto pelo WhatsApp.`,
  };
}

export default async function CidadePage({ params }: PageProps) {
  const { estado, cidade } = await params;
  const resultado = await buscarProfissionaisPorCidade({ estado, cidadeSlug: cidade });

  const nomeCidade = ehErroApi(resultado) ? nomeCidadeLegivel(cidade) : resultado.cidade.nome;
  const uf = estado.toUpperCase();

  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <div className="textura-gramado-sutil border-b border-areia-300">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
            <h1 className="font-display text-3xl font-semibold text-pinho-900">
              Corte de grama e jardinagem em {nomeCidade}, {uf}
            </h1>
            <p className="mt-2 text-pinho-700">
              Compare profissionais avaliados na sua regiao e combine tudo direto pelo WhatsApp.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          {ehErroApi(resultado) ? (
            <div className="rounded-2xl border border-areia-300 bg-white/60 p-8 text-center">
              <p className="font-display text-lg text-pinho-900">Ainda nao temos profissionais em {nomeCidade}.</p>
              <p className="mt-2 text-pinho-700">Digite seu CEP para buscar em uma area maior.</p>
              <div className="mx-auto mt-6 max-w-xl">
                <BuscaHero />
              </div>
            </div>
          ) : resultado.resultados.length === 0 ? (
            <div className="rounded-2xl border border-areia-300 bg-white/60 p-8 text-center">
              <p className="font-display text-lg text-pinho-900">Ainda nao encontramos profissionais em {nomeCidade}.</p>
              <p className="mt-2 text-pinho-700">Estamos crescendo! Volte em breve.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-pinho-700">
                {resultado.total} profissional{resultado.total > 1 ? "is" : ""} em {nomeCidade}
              </p>
              <div className="mt-4 flex flex-col gap-4">
                {resultado.resultados.map((p) => (
                  <CardProfissional key={p.usuarioId} profissional={p} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <Rodape />
    </>
  );
}
