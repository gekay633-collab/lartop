import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { RegistradorEvento } from "@/components/RegistradorEvento";
import { obterPerfilPublico, listarAvaliacoes, ehErroApi } from "@/lib/api";

function iniciais(nome: string): string {
  return nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PerfilProfissionalPage({ params }: PageProps) {
  const { id } = await params;
  const perfil = await obterPerfilPublico(id);

  if (ehErroApi(perfil)) {
    return (
      <>
        <Cabecalho />
        <main className="flex-1">
          <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
            <h1 className="font-display text-2xl font-semibold text-pinho-900">Perfil não encontrado</h1>
            <p className="mt-3 text-pinho-700">Esse profissional pode ter desativado o perfil ou o link está incorreto.</p>
            <a href="/" className="mt-6 inline-block rounded-xl bg-relva-500 px-6 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600">Voltar para a busca</a>
          </div>
        </main>
        <Rodape />
      </>
    );
  }

  const avaliacoes = await listarAvaliacoes(id);

  return (
    <>
      <Cabecalho />
      <RegistradorEvento tipo="VISUALIZACAO_PERFIL" profissionalId={perfil.usuarioId} cidadeId={perfil.cidade.id} />
      <main className="flex-1">
        <div className="textura-gramado-sutil border-b border-areia-300">
          <div className="mx-auto flex max-w-4xl flex-col items-start gap-4 px-4 py-8 sm:flex-row sm:items-center sm:gap-6 sm:py-10 sm:px-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-sauge-200 font-display text-2xl font-semibold text-pinho-900 sm:h-24 sm:w-24 sm:text-3xl md:h-28 md:w-28">
              {perfil.fotoPerfilUrl ? (
                <img src={perfil.fotoPerfilUrl} alt={perfil.nomeExibicao} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                iniciais(perfil.nomeExibicao)
              )}
            </div>
            <div className="flex flex-col justify-center gap-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-semibold text-pinho-900 sm:text-2xl md:text-3xl">{perfil.nomeExibicao}</h1>
                {perfil.seloVerificado && (
                  <span className="rounded-full bg-relva-500/15 px-2 py-0.5 text-xs font-medium text-relva-600">Verificado</span>
                )}
              </div>
              <p className="text-pinho-700">{perfil.cidade.nome}/{perfil.cidade.estado} · atende num raio de {perfil.raioAtendimentoKm} km</p>
              {perfil.totalAvaliacoes > 0 ? (
                <p className="font-data text-sm text-terra-600">
                  {perfil.notaMedia.toFixed(1)} <span className="font-body text-pinho-700">({perfil.totalAvaliacoes} avaliações)</span>
                </p>
              ) : (
                <p className="text-sm text-pinho-700">Ainda sem avaliações</p>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-4xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {perfil.bio && (
              <section>
                <h2 className="font-display text-xl font-semibold text-pinho-900">Sobre</h2>
                <p className="mt-2 text-pinho-900/80">{perfil.bio}</p>
              </section>
            )}

            {perfil.fotos.length > 0 && (
              <section className="mt-8">
                <h2 className="font-display text-xl font-semibold text-pinho-900">Antes e depois</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {perfil.fotos.map((foto) => (
                    <img key={foto.id} src={foto.urlDepois} alt={foto.descricao ?? "Trabalho realizado"} className="aspect-square rounded-xl object-cover" />
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8">
              <h2 className="font-display text-xl font-semibold text-pinho-900">Avaliações</h2>
              {avaliacoes.length === 0 ? (
                <p className="mt-2 text-pinho-700">Esse profissional ainda não recebeu avaliações.</p>
              ) : (
                <div className="mt-4 flex flex-col gap-4">
                  {avaliacoes.map((a) => (
                    <div key={a.id} className="rounded-xl border border-areia-300 bg-white/60 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-pinho-900">{a.avaliador.nome}</span>
                        <span className="font-data text-terra-600">{a.nota}/5</span>
                      </div>
                      {a.comentario && <p className="mt-2 text-pinho-900/80">{a.comentario}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside>
            <div className="sticky top-6 rounded-2xl border border-areia-300 bg-white/70 p-5">
              <h2 className="font-display text-lg font-semibold text-pinho-900">Serviços</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {perfil.categorias.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-pinho-900">{c.categoria.nome}</span>
                    {c.valorReferencia && (
                      <span className="font-data text-pinho-700">a partir de R$ {c.valorReferencia.toFixed(0)}</span>
                    )}
                  </li>
                ))}
              </ul>
              <a href={`/solicitar?profissionalId=${perfil.usuarioId}`} className="mt-5 block rounded-xl bg-relva-500 px-4 py-3 text-center font-semibold text-sauge-50 transition hover:bg-relva-600">Pedir orçamento</a>
            </div>
          </aside>
        </div>
      </main>
      <Rodape />
    </>
  );
}
