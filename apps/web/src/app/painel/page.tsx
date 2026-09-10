"use client";

import { useState } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { AbaLeads } from "@/components/AbaLeads";
import { AbaMeuPerfil } from "@/components/AbaMeuPerfil";
import { useGuardaProfissional } from "@/components/GuardaProfissional";

export default function PainelPage() {
  const { sessao, carregando } = useGuardaProfissional();
  const [aba, setAba] = useState<"leads" | "perfil">("leads");

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
        <div className="border-b border-areia-300 bg-sauge-100">
          <div className="mx-auto max-w-4xl px-4 py-4 sm:py-6 sm:px-6">
            <p className="text-sm text-pinho-700">Painel do profissional</p>
            <h1 className="font-display text-xl font-semibold text-pinho-900 sm:text-2xl">Ola, {sessao.nome}</h1>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8 sm:px-6">
          <div className="flex gap-4 border-b border-areia-300">
            <button onClick={() => setAba("leads")} className={aba === "leads" ? "pb-3 text-sm font-medium border-b-2 border-relva-500 text-pinho-900" : "pb-3 text-sm font-medium text-pinho-700"}>
              Leads recebidos
            </button>
            <button onClick={() => setAba("perfil")} className={aba === "perfil" ? "pb-3 text-sm font-medium border-b-2 border-relva-500 text-pinho-900" : "pb-3 text-sm font-medium text-pinho-700"}>
              Meu perfil
            </button>
          </div>

          <div className="mt-6">
            {aba === "leads" ? <AbaLeads accessToken={sessao.accessToken} /> : <AbaMeuPerfil accessToken={sessao.accessToken} />}
          </div>
        </div>
      </main>
      <Rodape />
    </>
  );
}
