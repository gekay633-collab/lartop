import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { BuscaHero } from "@/components/BuscaHero";
import { CardCategoria } from "@/components/CardCategoria";
import { Faq } from "@/components/Faq";

const CATEGORIAS = [
  { slug: "corte-de-grama", nome: "Corte de grama" },
  { slug: "poda", nome: "Poda de arvores e arbustos" },
  { slug: "paisagismo", nome: "Paisagismo" },
  { slug: "manutencao-jardim", nome: "Manutencao de jardim" },
  { slug: "limpeza-terreno", nome: "Limpeza de terreno" },
  { slug: "instalacao", nome: "Instalacao de grama/jardim" },
  { slug: "piscineiro", nome: "Piscineiro" },
];

const PASSOS = [
  { numero: "01", titulo: "Digite seu CEP", texto: "Mostramos os profissionais mais proximos de voce." },
  { numero: "02", titulo: "Compare perfis", texto: "Veja avaliacoes, fotos de antes e depois e valores de referencia." },
  { numero: "03", titulo: "Fale no WhatsApp", texto: "O contato e a negociacao acontecem direto com o profissional, sem intermediario." },
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
              <h1 className="font-display text-3xl font-semibold leading-tight text-sauge-50 sm:text-4xl md:text-5xl">Seu LAR nas maos de quem entende do assunto.</h1>
              <p className="mt-4 text-lg text-sauge-100">Encontre profissionais de jardinagem, piscina e cuidados com sua casa perto de voce. Compare avaliacoes e combine tudo direto pelo WhatsApp.</p>
            </div>
            <div className="max-w-3xl">
              <BuscaHero />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-pinho-900">O que voce precisa cuidar em casa?</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {CATEGORIAS.map((c) => (
              <CardCategoria key={c.slug} slug={c.slug} nome={c.nome} />
            ))}
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
          <p className="mx-auto mt-3 max-w-xl text-pinho-700">Publique seu perfil na Lartop de graca e receba pedidos de orcamento de clientes da sua regiao.</p>
          <a href="/para-profissionais" className="mt-6 inline-block rounded-xl bg-terra-500 px-6 py-3 font-semibold text-sauge-50 transition hover:bg-terra-600">Cadastrar meu perfil</a>
        </section>
      </main>
      <Rodape />
    </>
  );
}
