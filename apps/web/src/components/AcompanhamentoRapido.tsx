"use client";

import { useCallback, useEffect, useState } from "react";

interface Pedido {
  id: string;
  status: string;
  criadoEm: string;
  categoria: { nome: string };
  profissional: { nomeExibicao: string };
  linkWhatsapp?: string;
}

const STATUS: Record<string, string> = {
  PENDENTE: "Aguardando resposta do prestador",
  RESPONDIDA: "Profissional respondeu ao pedido",
  ACEITA: "Solicitação aceita pelo prestador",
  RECUSADA: "Prestador não poderá atender",
  CONCLUIDA: "Prestador marcou o serviço como concluído",
  CANCELADA: "Solicitação cancelada",
};

export function AcompanhamentoRapido({ id }: { id: string }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      // Fragmento da URL não é transmitido ao servidor em requisições HTTP.
      const token = window.location.hash.slice(1);
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        throw new Error("Este link está incompleto. Abra o link original de acompanhamento.");
      }
      const resposta = await fetch(`/api/solicitacoes/rapidas/${encodeURIComponent(id)}/acompanhar`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const resultado: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        const mensagem = resultado && typeof resultado === "object" && "erro" in resultado &&
          typeof resultado.erro === "string" ? resultado.erro : "Não foi possível consultar o pedido.";
        throw new Error(mensagem);
      }
      if (!resultado || typeof resultado !== "object" || !("id" in resultado) ||
          typeof resultado.id !== "string" || !("status" in resultado) ||
          typeof resultado.status !== "string" || !("profissional" in resultado) ||
          !resultado.profissional || typeof resultado.profissional !== "object" ||
          !("nomeExibicao" in resultado.profissional)) {
        throw new Error("O servidor retornou dados inesperados.");
      }
      setPedido(resultado as Pedido);
    } catch (falha) {
      setPedido(null);
      setErro(falha instanceof Error ? falha.message : "Erro ao acompanhar solicitação.");
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
    } catch {
      setErro("Copie o endereço desta página no navegador para guardar seu link.");
    }
  }

  return (
    <section className="rounded-2xl border border-areia-300 bg-white/75 p-5 sm:p-6">
      <h1 className="font-display text-2xl font-semibold text-pinho-900">Acompanhar solicitação</h1>
      <p className="mt-2 text-sm text-pinho-700">
        Este é um link privado. Não compartilhe com outras pessoas.
      </p>

      {carregando ? <p role="status" className="mt-5 text-pinho-700">Consultando pedido...</p> : null}
      {erro ? <p role="alert" className="mt-5 text-terra-600">{erro}</p> : null}
      {pedido ? (
        <div className="mt-5 flex flex-col gap-3">
          <div className="rounded-xl bg-sauge-100 p-4">
            <p className="text-sm text-pinho-700">Status atual</p>
            <p className="mt-1 font-semibold text-pinho-900">{STATUS[pedido.status] ?? "Em acompanhamento"}</p>
          </div>
          <p className="text-pinho-900"><strong>Serviço:</strong> {pedido.categoria.nome}</p>
          <p className="text-pinho-900"><strong>Profissional:</strong> {pedido.profissional.nomeExibicao}</p>
          <p className="text-sm text-pinho-700">Solicitação registrada em {new Date(pedido.criadoEm).toLocaleDateString("pt-BR")}</p>
          <p className="text-xs text-pinho-700">
            O status reflete as atualizações registradas na LARTOP. Ele não confirma que uma mensagem foi enviada pelo WhatsApp.
          </p>
          {pedido.linkWhatsapp?.startsWith("https://wa.me/") ? (
            <a href={pedido.linkWhatsapp} target="_blank" rel="noopener noreferrer"
              className="rounded-xl bg-relva-500 px-4 py-3 text-center font-semibold text-sauge-50">
              Abrir WhatsApp do profissional
            </a>
          ) : null}
          <button type="button" onClick={() => void copiar()}
            className="rounded-lg border border-areia-300 px-4 py-2 text-sm font-medium text-pinho-900">
            {copiado ? "Link copiado!" : "Copiar meu link privado"}
          </button>
        </div>
      ) : null}
      <button type="button" onClick={() => void carregar()} disabled={carregando}
        className="mt-4 rounded-lg border border-relva-500 px-4 py-2 text-sm font-medium text-relva-600 disabled:opacity-60">
        Atualizar status
      </button>
    </section>
  );
}
