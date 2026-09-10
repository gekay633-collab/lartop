"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

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
  CONCLUIDA: "Concluido",
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

  async function carregar() {
    try {
      const resposta = await fetch(`${API_URL}/api/solicitacoes/recebidas`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Erro ao carregar leads");
      setLeads(dados.itens);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao carregar leads");
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function mudarStatus(id: string, status: string) {
    await fetch(`${API_URL}/api/solicitacoes/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ status }),
    });
    carregar();
  }

  if (erro) return <p className="text-terra-600">{erro}</p>;
  if (!leads) return <p className="text-pinho-700">Carregando...</p>;
  if (leads.length === 0) return <p className="text-pinho-700">Voce ainda nao recebeu nenhum pedido de orcamento.</p>;

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
                  onClick={() => mudarStatus(lead.id, proximo)}
                  className="rounded-lg border border-relva-500 px-3 py-1.5 text-sm font-medium text-relva-600 transition hover:bg-relva-500 hover:text-sauge-50"
                >
                  Marcar como {ROTULOS_STATUS[proximo]}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
