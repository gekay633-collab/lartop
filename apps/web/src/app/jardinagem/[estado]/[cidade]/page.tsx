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
    title: `Jardineiro em ${nomeCidade}, ${uf} | Jardinagem e corte de grama | Lartop`,
    description: `Procurando jardineiro em ${nomeCidade}, ${uf}? Encontre profissionais de jardinagem, corte de grama, poda e manutenção de jardim. Compare perfis na Lartop.`,
    alternates: { canonical: `https://lartop.app.br/jardinagem/${estado.toLowerCase()}/${cidade.toLowerCase()}` },
  };
}

export default async function CidadePage({ params }: PageProps) {
  const { estado, cidade } = await params;
  const resultado = await buscarProfissionaisPorCidade({ estado, cidadeSlug: cidade, categoria: "jardinagem" });

  const nomeCidade = ehErroApi(resultado) ? nomeCidadeLegivel(cidade) : resultado.cidade.nome;
  const uf = estado.toUpperCase();

  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <div className="textura-gramado-sutil border-b border-areia-300">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
            <h1 className="font-display text-3xl font-semibold text-pinho-900">
              Jardineiros e serviços de jardinagem em {nomeCidade}, {uf}
            </h1>
            <p className="mt-2 text-pinho-700">
              Encontre profissionais para corte de grama, poda e manutenção de jardins. Compare perfis, portfólios e avaliações antes de solicitar um serviço.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          {ehErroApi(resultado) ? (
            <div className="rounded-2xl border border-areia-300 bg-white/60 p-8 text-center">
              <p className="font-display text-lg text-pinho-900">Ainda não temos profissionais em {nomeCidade}.</p>
              <p className="mt-2 text-pinho-700">Digite seu CEP para buscar em uma área maior.</p>
              <div className="mx-auto mt-6 max-w-xl">
                <BuscaHero />
              </div>
            </div>
          ) : resultado.resultados.length === 0 ? (
            <div className="rounded-2xl border border-areia-300 bg-white/60 p-8 text-center">
              <p className="font-display text-lg text-pinho-900">Ainda não encontramos profissionais em {nomeCidade}.</p>
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
        <section className="mx-auto max-w-4xl px-4 pb-12 sm:px-6" aria-labelledby="servicos-jardinagem">
          <h2 id="servicos-jardinagem" className="font-display text-2xl font-semibold text-pinho-900">Serviços de jardinagem em {nomeCidade}</h2>
          <p className="mt-3 text-pinho-700">Precisa de um jardineiro em {nomeCidade}? Na Lartop você pode encontrar profissionais para corte de grama, manutenção de jardins, poda e cuidados com áreas verdes. Confira os serviços informados em cada perfil e entre em contato pelo fluxo de solicitação disponível na plataforma.</p>
          <h2 className="mt-8 font-display text-xl font-semibold text-pinho-900">Como escolher um jardineiro?</h2>
          <p className="mt-3 text-pinho-700">Compare as fotos do portfólio, as avaliações e os serviços oferecidos. Antes de contratar, confirme com o profissional a disponibilidade, o escopo do trabalho e o orçamento.</p>
        </section>
      </main>
      <Rodape />
    </>
  );
}
