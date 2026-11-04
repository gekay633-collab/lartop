"use client";

import { fetchAutenticado } from "@/lib/auth-client";
import { useEffect, useState } from "react";

interface Lead {
  id: string;
  endereco: string;
  tamanhoM2: number;
  descricao: string | null;
  status: string;
  criadoEm: string;
  categoria: { nome: string };
  cliente: { nome: string; telefone: string | null; telefoneVerificado: boolean };
}

type Filtro = "NOVOS" | "EM_ANDAMENTO" | "HISTORICO" | "TODOS";

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: "NOVOS", texto: "Novos" },
  { valor: "EM_ANDAMENTO", texto: "Em andamento" },
  { valor: "HISTORICO", texto: "Histórico" },
  { valor: "TODOS", texto: "Todos" },
];
const POR_PAGINA = 5;

const ROTULOS_STATUS: Record<string, string> = {
  PENDENTE: "Novo pedido",
  RESPONDIDA: "Respondido",
  ACEITA: "Aceito",
  RECUSADA: "Recusado",
  CONCLUIDA: "Concluído",
  CANCELADA: "Cancelado",
};

const PROXIMOS_STATUS: Record<string, string[]> = {
  PENDENTE: ["RESPONDIDA", "ACEITA", "RECUSADA"],
  RESPONDIDA: ["ACEITA", "RECUSADA"],
  ACEITA: ["CONCLUIDA"],
};

const MENSAGENS_VAZIAS: Record<Filtro, string> = {
  NOVOS: "Nenhum pedido novo aguardando resposta.",
  EM_ANDAMENTO: "Nenhum pedido em andamento.",
  HISTORICO: "Seu histórico de pedidos ainda está vazio.",
  TODOS: "Você ainda não recebeu nenhum pedido de orçamento.",
};

export function AbaLeads({ accessToken }: { accessToken: string }) {
  const [filtro, setFiltro] = useState<Filtro>("NOVOS");
  const [pagina, setPagina] = useState(1);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);

  // Consulta paginada no servidor: não transferir todos os pedidos antigos
  // ao celular, nem deixar um pedido novo perdido entre os concluídos.
  useEffect(() => {
    let ativo = true;
    setLeads(null);
    setErro("");
    async function carregar() {
      try {
        const parametros = new URLSearchParams({
          pagina: String(pagina),
          porPagina: String(POR_PAGINA),
        });
        if (filtro !== "TODOS") parametros.set("grupo", filtro);
        const resposta = await fetchAutenticado(`/api/solicitacoes/recebidas?${parametros.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const dados: unknown = await resposta.json().catch(() => null);
        if (!resposta.ok) {
          const mensagem = dados && typeof dados === "object" && "erro" in dados
            && typeof dados.erro === "string" ? dados.erro
            : `Não foi possível carregar os pedidos (HTTP ${resposta.status}).`;
          throw new Error(mensagem);
        }
        if (!dados || typeof dados !== "object" || !("itens" in dados) ||
            !Array.isArray(dados.itens) || !("total" in dados) ||
            typeof dados.total !== "number") {
          throw new Error("Resposta inválida ao consultar os pedidos.");
        }
        if (!ativo) return;
        setLeads(dados.itens as Lead[]);
        setTotal(dados.total);
        setErro("");
      } catch (err) {
        if (ativo) {
          setErro(err instanceof Error ? err.message : "Erro ao carregar os pedidos.");
          setLeads([]);
        }
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, [accessToken, filtro, pagina, versao]);

  function escolherFiltro(novo: Filtro) {
    if (novo === filtro) return;
    setFiltro(novo);
    setPagina(1);
  }

  async function mudarStatus(id: string, status: string) {
    if (atualizandoId) return;
    setErro("");
    setAtualizandoId(id);
    try {
      const resposta = await fetchAutenticado(`/api/solicitacoes/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status }),
      });
      const dados: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        const mensagem = dados && typeof dados === "object" && "erro" in dados
          && typeof dados.erro === "string" ? dados.erro
          : `Não foi possível atualizar o pedido (HTTP ${resposta.status}).`;
        throw new Error(mensagem);
      }
      // Retorna ao início da aba selecionada e atualiza o total do servidor.
      setPagina(1);
      setVersao((atual) => atual + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao atualizar o pedido.");
    } finally {
      setAtualizandoId(null);
    }
  }

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-pinho-900">Organizar solicitações</p>
        <div role="group" aria-label="Filtrar solicitações" className="flex max-w-full gap-2 overflow-x-auto pb-2">
          {FILTROS.map(({ valor, texto }) => (
            <button key={valor} type="button"
              aria-pressed={filtro === valor}
              onClick={() => escolherFiltro(valor)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium ${filtro === valor
                ? "border-relva-500 bg-relva-500 text-white"
                : "border-areia-300 bg-white text-pinho-900 hover:bg-sauge-100"}`}>
              {texto}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-terra-600">{erro}</p>
          <button type="button" onClick={() => setVersao((atual) => atual + 1)}
            className="rounded-lg border border-relva-500 px-3 py-2 text-sm font-medium text-relva-600">
            Tentar novamente
          </button>
        </div>
      )}

      {!leads ? (
        <p role="status" className="text-pinho-700">Carregando pedidos...</p>
      ) : erro ? null : leads.length === 0 ? (
        <p role="status" className="rounded-xl border border-areia-300 bg-white/60 p-4 text-sm text-pinho-700">
          {MENSAGENS_VAZIAS[filtro]}
        </p>
      ) : (
        <>
          <p className="text-sm text-pinho-700">
            {total} {total === 1 ? "solicitação" : "solicitações"} nesta categoria · página {pagina} de {paginas}
          </p>
          {leads.map((lead) => (
            <div key={lead.id} className="rounded-2xl border border-areia-300 bg-white/70 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-pinho-900">{lead.categoria.nome}</p>
                  <p className="break-words text-sm text-pinho-700">{lead.cliente.nome} - {lead.endereco}</p>
                  <time className="text-xs text-pinho-700" dateTime={lead.criadoEm}>
                    {new Date(lead.criadoEm).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </time>
                </div>
                <span className="self-start shrink-0 rounded-full bg-sauge-200 px-3 py-1 text-xs font-medium text-pinho-900">
                  {ROTULOS_STATUS[lead.status] ?? lead.status}
                </span>
              </div>

              <p className="mt-2 font-data text-sm text-terra-600">{lead.tamanhoM2} m²</p>
              {lead.descricao && <p className="mt-1 break-words text-sm text-pinho-900/80">{lead.descricao}</p>}

              {(PROXIMOS_STATUS[lead.status] ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {PROXIMOS_STATUS[lead.status].map((proximo) => (
                    <button key={proximo} type="button"
                      onClick={() => void mudarStatus(lead.id, proximo)}
                      disabled={Boolean(atualizandoId)}
                      className="rounded-lg border border-relva-500 px-3 py-2 text-sm font-medium text-relva-600 transition hover:bg-relva-500 hover:text-sauge-50 disabled:cursor-not-allowed disabled:opacity-50">
                      {atualizandoId === lead.id ? "Atualizando..." : `Marcar como ${ROTULOS_STATUS[proximo]}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {paginas > 1 && (
            <nav aria-label="Páginas das solicitações" className="flex items-center justify-between gap-3 border-t border-areia-300 pt-4">
              <button type="button" disabled={pagina === 1 || Boolean(atualizandoId)}
                onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
                className="rounded-lg border border-areia-300 px-4 py-2 text-sm font-medium text-pinho-900 disabled:opacity-40">
                Anterior
              </button>
              <span className="text-sm text-pinho-700">{pagina} / {paginas}</span>
              <button type="button" disabled={pagina >= paginas || Boolean(atualizandoId)}
                onClick={() => setPagina((atual) => Math.min(paginas, atual + 1))}
                className="rounded-lg border border-areia-300 px-4 py-2 text-sm font-medium text-pinho-900 disabled:opacity-40">
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
