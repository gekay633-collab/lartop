"use client";

import { useEffect, useState } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { CardMinhaSolicitacao } from "@/components/CardMinhaSolicitacao";
import { useGuardaCliente } from "@/components/GuardaCliente";



interface Solicitacao {
  id: string;
  endereco: string;
  tamanhoM2: number;
  status: string;
  criadoEm: string;
  categoria: { nome: string };
  profissional: { nomeExibicao: string; fotoPerfilUrl: string | null };
}

export default function MinhasSolicitacoesPage() {
  const { sessao, carregando } = useGuardaCliente();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!sessao) return;

    setErro("");
    setSolicitacoes(null);
    fetch("/api/solicitacoes/minhas", {
      headers: { Authorization: `Bearer ${sessao.accessToken}` },
      cache: "no-store",
    })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error(`Falha ao carregar solicitações (HTTP ${resposta.status}).`);
        const dados: unknown = await resposta.json();
        if (!dados || typeof dados !== "object" || !("itens" in dados) || !Array.isArray(dados.itens)) {
          throw new Error("O servidor retornou uma lista de solicitações inválida.");
        }
        return dados.itens as Solicitacao[];
      })
      .then((itens) => setSolicitacoes(itens))
      .catch((falha) => {
        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar suas solicitações.");
        setSolicitacoes([]);
      });
  }, [sessao]);

  if (carregando || !sessao) {
    return (
      <>
        <Cabecalho />
        <main className="flex-1 px-4 py-16 text-center text-pinho-700">Carregando...</main>
        <Rodape />
      </>
    );
  }

  return (
    <>
      <Cabecalho />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <h1 className="font-display text-2xl font-semibold text-pinho-900">Minhas solicitações</h1>
          <p className="mt-2 text-pinho-700">Acompanhe seus pedidos de orçamento e avalie após a conclusão do serviço.</p>

          <div className="mt-6 flex flex-col gap-4">
            {erro && <p className="text-terra-600">{erro}</p>}
            {!solicitacoes ? (
              <p className="text-pinho-700">Carregando...</p>
            ) : erro ? null : solicitacoes.length === 0 ? (
              <div className="rounded-2xl border border-areia-300 bg-white/60 p-8 text-center">
                <p className="font-display text-lg text-pinho-900">Você ainda não pediu nenhum orçamento.</p>
                <a href="/" className="mt-4 inline-block text-sm font-medium text-relva-600 hover:underline">Buscar profissionais</a>
              </div>
            ) : (
              solicitacoes.map((s) => (
                <CardMinhaSolicitacao key={s.id} solicitacao={s} accessToken={sessao.accessToken} />
              ))
            )}
          </div>
        </div>
      </main>
      <Rodape />
    </>
  );
}
