"use client";

import { fetchAutenticado } from "@/lib/auth-client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SessaoLocal } from "@/lib/auth-client";

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  solicitacaoId: string | null;
  lidaEm: string | null;
  criadoEm: string;
}

interface Listagem {
  itens: Notificacao[];
  naoLidas: number;
}

function mensagemDeErro(dados: unknown, status: number): string {
  if (dados && typeof dados === "object" && "erro" in dados && typeof dados.erro === "string") {
    return dados.erro;
  }
  return `Não foi possível consultar as notificações (HTTP ${status}).`;
}

export function SinoNotificacoes({
  accessToken,
  tipo,
}: {
  accessToken: string;
  tipo: SessaoLocal["tipo"];
}) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState(false);
  const destino = tipo === "PROFISSIONAL" ? "/painel" : tipo === "CLIENTE" ? "/minhas-solicitacoes" : "/admin";

  useEffect(() => {
    let ativo = true;
    setItens([]);
    setNaoLidas(0);
    setErro("");

    async function carregar() {
      try {
        const resposta = await fetchAutenticado("/api/notificacoes?limite=15", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const dados: unknown = await resposta.json().catch(() => null);
        if (!resposta.ok) throw new Error(mensagemDeErro(dados, resposta.status));
        if (!dados || typeof dados !== "object" || !("itens" in dados) ||
          !Array.isArray(dados.itens) || !("naoLidas" in dados) ||
          typeof dados.naoLidas !== "number") {
          throw new Error("O servidor retornou notificações inválidas.");
        }
        if (!ativo) return;
        const listagem = dados as Listagem;
        setItens(listagem.itens);
        setNaoLidas(listagem.naoLidas);
        setErro("");
      } catch (falha) {
        if (ativo) setErro(falha instanceof Error ? falha.message : "Erro ao carregar notificações.");
      }
    }

    void carregar();
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") void carregar();
    }, 30000);
    const aoFocar = () => void carregar();
    window.addEventListener("focus", aoFocar);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.removeEventListener("focus", aoFocar);
    };
  }, [accessToken]);

  async function marcarLida(id: string) {
    if (processando) return;
    setProcessando(true);
    try {
      const resposta = await fetchAutenticado(`/api/notificacoes/${id}/lida`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const dados: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(mensagemDeErro(dados, resposta.status));
      setItens(anteriores => anteriores.map(item =>
        item.id === id ? { ...item, lidaEm: item.lidaEm || new Date().toISOString() } : item
      ));
      const eraNaoLida = itens.some(item => item.id === id && !item.lidaEm);
      if (eraNaoLida) setNaoLidas(atual => Math.max(0, atual - 1));
      setErro("");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível marcar como lida.");
    } finally {
      setProcessando(false);
    }
  }

  async function marcarTodas() {
    if (processando) return;
    setProcessando(true);
    try {
      const resposta = await fetchAutenticado("/api/notificacoes/marcar-todas", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const dados: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(mensagemDeErro(dados, resposta.status));
      const agora = new Date().toISOString();
      setItens(anteriores => anteriores.map(item => ({ ...item, lidaEm: item.lidaEm || agora })));
      setNaoLidas(0);
      setErro("");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível atualizar as notificações.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setAberto(valor => !valor)}
        aria-label={`Notificações: ${naoLidas} não lidas`} aria-expanded={aberto}
        aria-controls="central-notificacoes"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-areia-300 bg-white text-xl text-pinho-900 hover:bg-sauge-100">
        <span aria-hidden="true">🔔</span>
        {naoLidas > 0 && (
          <span aria-hidden="true" className="absolute -right-2 -top-2 min-w-5 rounded-full bg-terra-600 px-1 text-center text-xs font-bold text-white">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <section id="central-notificacoes" aria-label="Central de notificações"
          className="fixed inset-x-3 top-[calc(4.25rem+env(safe-area-inset-top,0px))] z-50 flex max-h-[calc(100dvh-7rem)] min-w-0 flex-col overflow-hidden rounded-xl border border-areia-300 bg-white p-3 text-pinho-900 shadow-xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[22rem] sm:max-w-[calc(100vw-2rem)] sm:max-h-[min(75vh,34rem)]">
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-areia-200 pb-2">
            <h2 className="min-w-0 font-semibold">Notificações</h2>
            <div className="flex shrink-0 items-center gap-2">
              {naoLidas > 0 && (
                <button type="button" onClick={() => void marcarTodas()} disabled={processando}
                  className="max-w-36 text-right text-xs font-medium text-relva-600 hover:underline disabled:opacity-50">
                  Marcar todas como lidas
                </button>
              )}
              <button type="button" onClick={() => setAberto(false)}
                aria-label="Fechar notificações"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-pinho-700 hover:bg-sauge-100">
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </div>
          {erro && <p role="alert" className="mt-2 break-words text-sm text-terra-600">{erro}</p>}
          {itens.length === 0 ? (
            <p className="py-5 text-center text-sm text-pinho-700">Nenhuma notificação por enquanto.</p>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-areia-200 overflow-y-auto overscroll-contain">
              {itens.map(item => (
                <li key={item.id} className={`py-3 text-sm ${!item.lidaEm ? "font-medium" : ""}`}>
                  <Link href={destino} onClick={() => setAberto(false)}
                    className="block break-words [overflow-wrap:anywhere] text-pinho-900 hover:underline">{item.titulo}</Link>
                  <p className="mt-1 break-words font-normal text-pinho-700 [overflow-wrap:anywhere]">{item.mensagem}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <time className="text-xs font-normal text-pinho-700">
                      {new Date(item.criadoEm).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </time>
                    {!item.lidaEm && (
                      <button type="button" disabled={processando}
                        onClick={() => void marcarLida(item.id)}
                        className="min-h-8 text-right text-xs text-relva-600 hover:underline disabled:opacity-50">
                        Marcar como lida
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
