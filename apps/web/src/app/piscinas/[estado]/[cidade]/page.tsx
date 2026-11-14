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
  return slug.split("-").map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1)).join(" ");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { estado, cidade } = await params;
  const nomeCidade = nomeCidadeLegivel(cidade);
  const uf = estado.toUpperCase();
  return {
    title: `Piscineiros e manutenção de piscinas em ${nomeCidade}, ${uf} | Lartop`,
    description: `Encontre profissionais de manutenção e limpeza de piscinas em ${nomeCidade}/${uf}. Compare perfis e encontre atendimento na sua região.`,
  };
}

export default async function PiscinasCidadePage({ params }: PageProps) {
  const { estado, cidade } = await params;
  const resultado = await buscarProfissionaisPorCidade({ estado, cidadeSlug: cidade, categoria: "piscineiro" });
  const nomeCidade = ehErroApi(resultado) ? nomeCidadeLegivel(cidade) : resultado.cidade.nome;
  const uf = estado.toUpperCase();

  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <div className="textura-gramado-sutil border-b border-areia-300">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
            <h1 className="font-display text-3xl font-semibold text-pinho-900">
              Limpeza e manutenção de piscinas em {nomeCidade}, {uf}
            </h1>
            <p className="mt-2 text-pinho-700">
              Encontre piscineiros da sua região, compare perfis e escolha um profissional para cuidar da sua piscina.
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          {ehErroApi(resultado) ? (
            <div className="rounded-2xl border border-areia-300 bg-white/60 p-8 text-center">
              <p className="font-display text-lg text-pinho-900">Não foi possível consultar os profissionais agora.</p>
              <p className="mt-2 text-pinho-700">Tente novamente ou busque profissionais pelo seu CEP.</p>
              <div className="mx-auto mt-6 max-w-xl"><BuscaHero /></div>
            </div>
          ) : resultado.resultados.length === 0 ? (
            <div className="rounded-2xl border border-areia-300 bg-white/60 p-8 text-center">
              <p className="font-display text-lg text-pinho-900">Ainda não encontramos piscineiros em {nomeCidade}.</p>
              <p className="mt-2 text-pinho-700">Estamos crescendo! Volte em breve ou busque pelo seu CEP.</p>
              <div className="mx-auto mt-6 max-w-xl"><BuscaHero /></div>
            </div>
          ) : (
            <>
              <p className="text-sm text-pinho-700">
                {resultado.total} profissional{resultado.total > 1 ? "is" : ""} em {nomeCidade}
              </p>
              <div className="mt-4 flex flex-col gap-4">
                {resultado.resultados.map((profissional) => (
                  <CardProfissional key={profissional.usuarioId} profissional={profissional} />
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
