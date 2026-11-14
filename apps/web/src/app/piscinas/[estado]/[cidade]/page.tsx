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
    description: `Procurando piscineiro em ${nomeCidade}, ${uf}? Encontre profissionais para limpeza, tratamento da água e manutenção de piscinas. Compare perfis na Lartop.`,
    alternates: { canonical: `https://lartop.app.br/piscinas/${estado.toLowerCase()}/${cidade.toLowerCase()}` },
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
        <section className="mx-auto max-w-4xl px-4 pb-12 sm:px-6" aria-labelledby="servicos-piscinas">
          <h2 id="servicos-piscinas" className="font-display text-2xl font-semibold text-pinho-900">Serviços de limpeza e manutenção de piscinas em {nomeCidade}</h2>
          <p className="mt-3 text-pinho-700">Precisa de um piscineiro em {nomeCidade}? Na Lartop você pode consultar perfis de profissionais que oferecem cuidados com piscinas, como limpeza, tratamento da água e manutenção. Verifique os serviços descritos em cada perfil antes de solicitar atendimento.</p>
          <h2 className="mt-8 font-display text-xl font-semibold text-pinho-900">Como escolher um piscineiro?</h2>
          <p className="mt-3 text-pinho-700">Compare os serviços oferecidos, as avaliações e as fotos do portfólio, quando disponíveis. Confirme diretamente com o profissional a disponibilidade, a frequência das visitas e o orçamento.</p>
          <div className="mt-8 border-t border-areia-300 pt-6">
            <h2 className="font-display text-xl font-semibold text-pinho-900">Dúvidas sobre piscineiros em {nomeCidade}</h2>
            <h3 className="mt-4 font-semibold text-pinho-900">Quais serviços posso encontrar?</h3>
            <p className="mt-2 text-pinho-700">Os perfis podem oferecer limpeza da piscina, tratamento da água e manutenção. Confira o que cada profissional realiza antes de solicitar o serviço.</p>
            <h3 className="mt-4 font-semibold text-pinho-900">Como solicitar um orçamento?</h3>
            <p className="mt-2 text-pinho-700">Escolha um perfil disponível e utilize o fluxo de solicitação da Lartop. Combine diretamente com o profissional os detalhes, o preço e a disponibilidade.</p>
            <p className="mt-6 text-pinho-700">Também procura serviços para o jardim? <a className="font-semibold text-terra-600 underline" href="/jardinagem/rj/marica">Veja profissionais de jardinagem em Maricá</a>.</p>
          </div>
        </section>
      </main>
      <Rodape />
    </>
  );
}
