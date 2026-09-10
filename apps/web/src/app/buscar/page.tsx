import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { CardProfissional } from "@/components/CardProfissional";
import { RegistradorEvento } from "@/components/RegistradorEvento";
import { buscarProfissionais, ehErroApi } from "@/lib/api";

const CATEGORIAS: Record<string, string> = {
  "corte-de-grama": "Corte de grama",
  poda: "Poda de árvores e arbustos",
  paisagismo: "Paisagismo",
  "manutencao-jardim": "Manutenção de jardim",
  "limpeza-terreno": "Limpeza de terreno",
  instalacao: "Instalação de grama/jardim",
};

interface PageProps {
  searchParams: Promise<{ cep?: string; categoria?: string }>;
}

export default async function BuscarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const cep = params.cep ?? "";
  const categoria = params.categoria ?? "";

  if (!cep) {
    return (
      <>
        <Cabecalho />
        <main className="flex-1">
          <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
            <h1 className="font-display text-2xl font-semibold text-pinho-900">Digite um CEP para começar</h1>
            <p className="mt-3 text-pinho-700">Volte para a página inicial e informe seu CEP para ver os profissionais disponíveis na sua região.</p>
            <a href="/" className="mt-6 inline-block rounded-xl bg-relva-500 px-6 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600">Voltar para a busca</a>
          </div>
        </main>
        <Rodape />
      </>
    );
  }

  const resultado = await buscarProfissionais({ cep, categoria: categoria || undefined });

  return (
    <>
      <Cabecalho />
      {!ehErroApi(resultado) && (
        <RegistradorEvento tipo="PESQUISA" cidadeId={resultado.cidadeId} categoriaId={categoria || undefined} />
      )}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <h1 className="font-display text-2xl font-semibold text-pinho-900">
            {categoria ? CATEGORIAS[categoria] ?? "Profissionais" : "Todos os profissionais"}
          </h1>

          {ehErroApi(resultado) ? (
            <div className="mt-10 rounded-2xl border border-terra-500/30 bg-terra-500/10 p-6">
              <p className="font-medium text-terra-600">{resultado.erro}</p>
              <p className="mt-2 text-sm text-pinho-700">Confira se o CEP digitado está correto e tente novamente.</p>
              <a href="/" className="mt-4 inline-block text-sm font-medium text-relva-600 hover:underline">Voltar para a busca</a>
            </div>
          ) : resultado.resultados.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-areia-300 bg-white/60 p-8 text-center">
              <p className="font-display text-lg text-pinho-900">Ainda não encontramos profissionais nessa região.</p>
              <p className="mt-2 text-pinho-700">Estamos crescendo! Volte em breve ou tente aumentar a área de busca.</p>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-pinho-700">
                {resultado.total} profissional{resultado.total > 1 ? "is" : ""} encontrado{resultado.total > 1 ? "s" : ""} num raio de {resultado.raioKm} km do CEP {resultado.cepBuscado}
              </p>
              <div className="mt-6 flex flex-col gap-4">
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
