"use client";

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

export function AbaLeads({ accessToken }: { accessToken: string }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [erro, setErro] = useState("");
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);

  async function carregar() {
    setErro("");
    try {
      const resposta = await fetch("/api/solicitacoes/recebidas", {
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
      if (!dados || typeof dados !== "object" || !("itens" in dados) || !Array.isArray(dados.itens)) {
        throw new Error("Resposta inválida ao consultar os pedidos.");
      }
      setLeads(dados.itens as Lead[]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao carregar os pedidos.");
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function mudarStatus(id: string, status: string) {
    if (atualizandoId) return;
    setErro("");
    setAtualizandoId(id);
    try {
      const resposta = await fetch(`/api/solicitacoes/${id}/status`, {
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
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao atualizar o pedido.");
    } finally {
      setAtualizandoId(null);
    }
  }

  if (erro) return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="text-terra-600">{erro}</p>
      <button type="button" onClick={() => void carregar()}
        className="rounded-lg border border-relva-500 px-3 py-2 text-sm font-medium text-relva-600">
        Tentar novamente
      </button>
    </div>
  );
  if (!leads) return <p className="text-pinho-700">Carregando...</p>;
  if (leads.length === 0) return <p className="text-pinho-700">Você ainda não recebeu nenhum pedido de orçamento.</p>;

  return (
    <div className="flex flex-col gap-4">
      {leads.map((lead) => (
        <div key={lead.id} className="rounded-2xl border border-areia-300 bg-white/70 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-display text-lg font-semibold text-pinho-900">{lead.categoria.nome}</p>
              <p className="text-sm text-pinho-700">{lead.cliente.nome} - {lead.endereco}</p>
            </div>
            <span className="shrink-0 rounded-full bg-sauge-200 px-3 py-1 text-xs font-medium text-pinho-900">
              {ROTULOS_STATUS[lead.status] ?? lead.status}
            </span>
          </div>

          <p className="mt-2 font-data text-sm text-terra-600">{lead.tamanhoM2} m2</p>
          {lead.descricao && <p className="mt-1 text-sm text-pinho-900/80">{lead.descricao}</p>}

          {(PROXIMOS_STATUS[lead.status] ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {PROXIMOS_STATUS[lead.status].map((proximo) => (
                <button
                  key={proximo}
                  onClick={() => void mudarStatus(lead.id, proximo)}
                  disabled={Boolean(atualizandoId)}
                  className="rounded-lg border border-relva-500 px-3 py-1.5 text-sm font-medium text-relva-600 transition hover:bg-relva-500 hover:text-sauge-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {atualizandoId === lead.id ? "Atualizando..." : `Marcar como ${ROTULOS_STATUS[proximo]}`}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
