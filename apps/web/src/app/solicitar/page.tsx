import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { FormularioSolicitacao } from "@/components/FormularioSolicitacao";
import { obterPerfilPublico, ehErroApi } from "@/lib/api";

interface PageProps {
  searchParams: Promise<{ profissionalId?: string }>;
}

export default async function SolicitarPage({ searchParams }: PageProps) {
  const { profissionalId } = await searchParams;

  if (!profissionalId) {
    return (
      <>
        <Cabecalho />
        <main className="flex-1">
          <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
            <h1 className="font-display text-2xl font-semibold text-pinho-900">Nenhum profissional selecionado</h1>
            <p className="mt-3 text-pinho-700">Volte para a busca e escolha um profissional para pedir orcamento.</p>
            <a href="/" className="mt-6 inline-block rounded-xl bg-relva-500 px-6 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600">Voltar para a busca</a>
          </div>
        </main>
        <Rodape />
      </>
    );
  }

  const perfil = await obterPerfilPublico(profissionalId);

  if (ehErroApi(perfil)) {
    return (
      <>
        <Cabecalho />
        <main className="flex-1">
          <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
            <h1 className="font-display text-2xl font-semibold text-pinho-900">Profissional nao encontrado</h1>
            <p className="mt-3 text-pinho-700">{perfil.erro}</p>
            <a href="/" className="mt-6 inline-block rounded-xl bg-relva-500 px-6 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600">Voltar para a busca</a>
          </div>
        </main>
        <Rodape />
      </>
    );
  }

  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
          <a href={`/profissional/${profissionalId}`} className="text-sm text-relva-600 hover:underline">
            &larr; Voltar para o perfil
          </a>
          <h1 className="mt-3 font-display text-2xl font-semibold text-pinho-900">
            Pedir orcamento para {perfil.nomeExibicao}
          </h1>
          <p className="mt-2 text-pinho-700">
            Preencha os dados do servico. Ao enviar, geramos um link para voce falar direto no WhatsApp.
          </p>

          <div className="mt-6">
            <FormularioSolicitacao
              profissionalId={perfil.usuarioId}
              profissionalNome={perfil.nomeExibicao}
              categorias={perfil.categorias}
            />
          </div>
        </div>
      </main>
      <Rodape />
    </>
  );
}
