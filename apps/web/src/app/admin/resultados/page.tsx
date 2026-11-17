"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { fetchAutenticado } from "@/lib/auth-client";
import { useGuardaAdmin } from "@/components/GuardaAdmin";

type Periodo = "30d" | "todos";

interface Metricas {
  recebidos: number;
  pendentes: number;
  respondidosOuAceitos: number;
  aceitosOuConcluidos: number;
  concluidosInformados: number;
  recusados: number;
  cancelados: number;
  semCadastro: number;
  avisosRegistrados: number;
  avaliacoes: number;
  feedbacksVisitantes: number;
}

interface LinhaResultado {
  usuarioId: string;
  nomeExibicao: string;
  perfilPublicado: boolean;
  contaAtiva: boolean;
  cidade: { nome: string; estado: string };
  notaMediaGeral: number;
  totalAvaliacoesGeral: number;
  metricas: Metricas;
}

interface Resultado {
  total: number;
  pagina: number;
  porPagina: number;
  periodo: Periodo;
  itens: LinhaResultado[];
}

function Indicador({ nome, valor }: { nome: string; valor: number }) {
  return (
    <div className="rounded-xl border border-areia-300 bg-white/70 px-3 py-3">
      <dt className="text-xs text-pinho-700">{nome}</dt>
      <dd className="mt-1 font-data text-xl font-semibold text-pinho-900">{valor}</dd>
    </div>
  );
}

export default function AdminResultadosPage() {
  const { sessao } = useGuardaAdmin();
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [pagina, setPagina] = useState(1);
  const [atualizacao, setAtualizacao] = useState(0);
  const [dados, setDados] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!sessao) return;
    let ativo = true;
    setCarregando(true);
    setErro("");
    const parametros = new URLSearchParams({
      periodo,
      pagina: String(pagina),
      porPagina: "20",
    });
    if (buscaAplicada) parametros.set("busca", buscaAplicada);

    void fetchAutenticado(`/api/admin/resultados-prestadores?${parametros}`, {
      cache: "no-store",
    }).then(async (resposta) => {
      if (!resposta.ok) {
        throw new Error(`Não foi possível consultar os resultados (HTTP ${resposta.status}).`);
      }
      return resposta.json() as Promise<Resultado>;
    }).then((resultado) => {
      if (ativo) setDados(resultado);
    }).catch((falha) => {
      if (ativo) setErro(falha instanceof Error ? falha.message : "Erro ao consultar resultados.");
    }).finally(() => {
      if (ativo) setCarregando(false);
    });
    return () => { ativo = false; };
  }, [sessao?.accessToken, periodo, pagina, buscaAplicada, atualizacao]);

  function pesquisar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setPagina(1);
    setBuscaAplicada(busca.trim());
  }

  const ultimaPagina = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-pinho-900">Resultados dos prestadores</h1>
          <p className="mt-2 max-w-3xl text-sm text-pinho-700">
            Acompanhe pedidos registrados, respostas, conclusões informadas e feedbacks recebidos por cada profissional.
          </p>
        </div>
        <button type="button" onClick={() => setAtualizacao((n) => n + 1)}
          className="rounded-lg border border-relva-500 px-4 py-2 text-sm font-semibold text-relva-600">
          Atualizar dados
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-areia-300 bg-white/70 p-4 text-sm text-pinho-700">
        <strong className="text-pinho-900">Como interpretar:</strong> “Recebidos” significa pedidos criados na LARTOP.
        “Avisos registrados” indica que a notificação foi criada no sistema, não que chegou ao celular.
        “Concluídos” são serviços que o prestador marcou como finalizados; isso não comprova um pagamento ou contratação.
        Os feedbacks refletem avaliações enviadas pelos clientes.
        Os pedidos são filtrados pela data de criação; as avaliações, pela data em que foram enviadas.
      </div>

      <form onSubmit={pesquisar} className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="resultado-busca" className="block text-sm font-medium text-pinho-900">Prestador</label>
          <input id="resultado-busca" value={busca} maxLength={120}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar nome ou e-mail"
            className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-2.5 text-pinho-900" />
        </div>
        <div>
          <label htmlFor="resultado-periodo" className="block text-sm font-medium text-pinho-900">Período</label>
          <select id="resultado-periodo" value={periodo} onChange={(e) => {
            setPeriodo(e.target.value as Periodo); setPagina(1);
          }} className="mt-1 rounded-lg border border-areia-300 bg-white px-3 py-2.5 text-pinho-900">
            <option value="30d">Últimos 30 dias</option>
            <option value="todos">Todo o histórico</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-pinho-900 px-4 py-2.5 text-sm font-semibold text-sauge-50">
          Pesquisar
        </button>
      </form>

      {erro && <div role="alert" className="mt-5 rounded-xl border border-terra-500/50 p-4 text-sm text-terra-600">{erro}</div>}
      {carregando && <p role="status" className="mt-5 text-pinho-700">Consultando resultados...</p>}

      {!carregando && !erro && dados && (
        <>
          <p className="mt-5 text-sm text-pinho-700">
            {dados.total} prestador{dados.total === 1 ? "" : "es"} encontrado{dados.total === 1 ? "" : "s"}.
            Mostrando página {dados.pagina} de {ultimaPagina}.
          </p>
          {dados.itens.length === 0 ? (
            <p className="mt-4 rounded-xl border border-areia-300 p-5 text-pinho-700">
              Nenhum prestador corresponde à pesquisa.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {dados.itens.map((p) => {
                const m = p.metricas;
                return (
                  <section key={p.usuarioId} className="rounded-2xl border border-areia-300 bg-white/70 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-lg font-semibold text-pinho-900">{p.nomeExibicao}</h2>
                        <p className="mt-1 text-sm text-pinho-700">
                          {p.cidade.nome}/{p.cidade.estado} · {p.perfilPublicado ? "Perfil publicado" : "Perfil não publicado"}
                          {p.contaAtiva ? "" : " · Conta bloqueada"}
                        </p>
                        <p className="mt-1 text-sm text-pinho-700">
                          Nota geral: <strong className="text-pinho-900">
                            {p.totalAvaliacoesGeral > 0 ? p.notaMediaGeral.toFixed(1).replace(".", ",") : "Sem notas"}
                          </strong> · {p.totalAvaliacoesGeral} avaliação(ões) no histórico
                        </p>
                      </div>
                      <Link href={`/profissional/${p.usuarioId}`}
                        className="rounded-lg border border-relva-500 px-3 py-2 text-sm font-medium text-relva-600">
                        Ver perfil
                      </Link>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      <Indicador nome="Pedidos recebidos" valor={m.recebidos} />
                      <Indicador nome="Sem cadastro" valor={m.semCadastro} />
                      <Indicador nome="Aguardando resposta" valor={m.pendentes} />
                      <Indicador nome="Respondidos / aceitos" valor={m.respondidosOuAceitos} />
                      <Indicador nome="Aceitos ou concluídos" valor={m.aceitosOuConcluidos} />
                      <Indicador nome="Concluídos informados" valor={m.concluidosInformados} />
                      <Indicador nome="Recusados" valor={m.recusados} />
                      <Indicador nome="Cancelados" valor={m.cancelados} />
                      <Indicador nome="Avisos registrados" valor={m.avisosRegistrados} />
                      <Indicador nome="Feedbacks recebidos" valor={m.avaliacoes} />
                    </dl>
                    <p className="mt-3 text-xs text-pinho-700">
                      {m.feedbacksVisitantes} avaliação(ões) de clientes sem cadastro neste período.
                    </p>
                  </section>
                );
              })}
            </div>
          )}
          {ultimaPagina > 1 && (
            <div className="mt-5 flex items-center gap-3">
              <button type="button" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}
                className="rounded-lg border border-areia-300 px-4 py-2 text-sm text-pinho-900 disabled:opacity-40">
                Anterior
              </button>
              <span className="text-sm text-pinho-700">{pagina} / {ultimaPagina}</span>
              <button type="button" disabled={pagina >= ultimaPagina} onClick={() => setPagina((n) => n + 1)}
                className="rounded-lg border border-areia-300 px-4 py-2 text-sm text-pinho-900 disabled:opacity-40">
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
