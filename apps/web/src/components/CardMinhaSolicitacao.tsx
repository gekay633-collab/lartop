"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

interface Solicitacao {
  id: string;
  endereco: string;
  tamanhoM2: number;
  status: string;
  criadoEm: string;
  categoria: { nome: string };
  profissional: { nomeExibicao: string; fotoPerfilUrl: string | null };
  jaAvaliada?: boolean;
}

const ROTULOS_STATUS: Record<string, string> = {
  PENDENTE: "Aguardando resposta",
  RESPONDIDA: "Respondido pelo profissional",
  ACEITA: "Aceito, servico agendado",
  RECUSADA: "Recusado",
  CONCLUIDA: "Concluido",
  CANCELADA: "Cancelado",
};

export function CardMinhaSolicitacao({ solicitacao, accessToken }: { solicitacao: Solicitacao; accessToken: string }) {
  const [avaliado, setAvaliado] = useState(solicitacao.jaAvaliada ?? false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviarAvaliacao() {
    setEnviando(true);
    setErro("");
    try {
      const resposta = await fetch(`${API_URL}/api/avaliacoes/cliente`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ solicitacaoId: solicitacao.id, nota, comentario: comentario || undefined }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Nao foi possivel enviar a avaliacao");
      setAvaliado(true);
      setMostrarForm(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao avaliar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-areia-300 bg-white/70 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold text-pinho-900">{solicitacao.categoria.nome}</p>
          <p className="text-sm text-pinho-700">com {solicitacao.profissional.nomeExibicao}</p>
        </div>
        <span className="shrink-0 rounded-full bg-sauge-200 px-3 py-1 text-xs font-medium text-pinho-900">
          {ROTULOS_STATUS[solicitacao.status] ?? solicitacao.status}
        </span>
      </div>

      <p className="mt-2 text-sm text-pinho-700">{solicitacao.endereco}</p>
      <p className="mt-1 font-data text-sm text-terra-600">{solicitacao.tamanhoM2} m2</p>

      {solicitacao.status === "CONCLUIDA" && avaliado && (
        <p className="mt-3 text-sm text-relva-600">Avaliacao enviada, obrigado!</p>
      )}

      {solicitacao.status === "CONCLUIDA" && !avaliado && (
        <div className="mt-3">
          {!mostrarForm ? (
            <button onClick={() => setMostrarForm(true)} className="rounded-lg bg-relva-500 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-relva-600">
              Avaliar servico
            </button>
          ) : (
            <div className="rounded-xl border border-areia-300 bg-sauge-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-pinho-700">Sua nota</p>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setNota(n)} className={n <= nota ? "text-2xl text-terra-500" : "text-2xl text-areia-300"}>
                    ★
                  </button>
                ))}
              </div>
              <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Como foi o servico? (opcional)" rows={2} className="mt-2 w-full rounded-lg border border-areia-300 bg-white px-3 py-2 text-sm text-pinho-900 outline-none focus:border-relva-500" />
              {erro && <p className="mt-1 text-sm text-terra-600">{erro}</p>}
              <button onClick={enviarAvaliacao} disabled={enviando} className="mt-2 rounded-lg bg-relva-500 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-relva-600 disabled:opacity-60">
                {enviando ? "Enviando..." : "Enviar avaliacao"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
