import type { Metadata } from "next";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { BuscaHero } from "@/components/BuscaHero";
import { AcessoBuscaCliente } from "@/components/AcessoBuscaCliente";
import { CategoriasHome } from "@/components/CategoriasHome";
import { Faq } from "@/components/Faq";

export const metadata: Metadata = {
  title: "Lartop | Jardineiros e piscineiros em Maricá, RJ",
  description: "Encontre jardineiros, profissionais de corte de grama e piscineiros em Maricá, RJ. Compare perfis, avaliações e serviços disponíveis na sua região.",
  alternates: { canonical: "https://lartop.app.br/" },
};

const PASSOS = [
  { numero: "01", titulo: "Digite seu CEP", texto: "Mostramos os profissionais mais próximos de você." },
  { numero: "02", titulo: "Compare perfis", texto: "Veja avaliações, fotos do portfólio e informações sobre os serviços." },
  { numero: "03", titulo: "Solicite o serviço", texto: "Escolha o profissional e siga as etapas de solicitação disponíveis na Lartop." },
];

export default function HomePage() {
  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <section className="textura-gramado relative overflow-hidden">
          <div className="absolute inset-0 bg-pinho-900/55" />
          <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 sm:py-20 md:py-28">
            <div className="max-w-2xl">
              <h1 className="font-display text-3xl font-semibold leading-tight text-sauge-50 sm:text-4xl md:text-5xl">Encontre jardineiros e piscineiros em Maricá.</h1>
              <p className="mt-4 text-lg text-sauge-100">Compare perfis de profissionais de jardinagem, corte de grama e manutenção de piscinas na sua região. Busque pelo CEP ou explore os serviços disponíveis em Maricá.</p>
            </div>
            <div className="max-w-3xl">
              <AcessoBuscaCliente><BuscaHero /></AcessoBuscaCliente>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-pinho-900">De qual serviço sua casa precisa?</h2>
          <AcessoBuscaCliente><CategoriasHome /></AcessoBuscaCliente>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-pinho-900">Serviços em Maricá, RJ</h2>
          <p className="mt-2 text-pinho-700">Encontre profissionais para cuidar do jardim ou da piscina da sua casa.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <a href="/jardinagem/rj/marica" className="group rounded-2xl border border-areia-300 bg-white p-6 transition hover:border-relva-500 hover:shadow-md">
              <h3 className="font-display text-xl font-semibold text-pinho-900 group-hover:text-relva-600">Jardineiros em Maricá</h3>
              <p className="mt-2 text-pinho-700">Corte de grama, poda, manutenção de jardins e paisagismo.</p>
              <span className="mt-4 inline-block font-semibold text-terra-600">Ver profissionais de jardinagem →</span>
            </a>
            <a href="/piscinas/rj/marica" className="group rounded-2xl border border-areia-300 bg-white p-6 transition hover:border-relva-500 hover:shadow-md">
              <h3 className="font-display text-xl font-semibold text-pinho-900 group-hover:text-relva-600">Piscineiros em Maricá</h3>
              <p className="mt-2 text-pinho-700">Limpeza, cuidados e manutenção de piscinas.</p>
              <span className="mt-4 inline-block font-semibold text-terra-600">Ver profissionais de piscinas →</span>
            </a>
          </div>
        </section>

        <section className="textura-gramado-sutil border-y border-areia-300">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="font-display text-2xl font-semibold text-pinho-900">Como funciona</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              {PASSOS.map((p) => (
                <div key={p.numero} className="flex flex-col gap-2">
                  <span className="font-data text-sm text-terra-600">{p.numero}</span>
                  <h3 className="font-display text-xl font-medium text-pinho-900">{p.titulo}</h3>
                  <p className="text-pinho-700">{p.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center font-display text-2xl font-semibold text-pinho-900">Perguntas frequentes</h2>
          <div className="mt-8">
            <Faq />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-pinho-900">E profissional de jardinagem ou piscina?</h2>
          <p className="mx-auto mt-3 max-w-xl text-pinho-700">Publique seu perfil na Lartop de graça e receba pedidos de orçamento de clientes da sua região.</p>
          <a href="/para-profissionais" className="mt-6 inline-block rounded-xl bg-terra-500 px-6 py-3 font-semibold text-sauge-50 transition hover:bg-terra-600">Cadastrar meu perfil</a>
        </section>
      </main>
      <Rodape />
    </>
  );
}
