"use client";

import { fetchAutenticado } from "@/lib/auth-client";

import { useEffect, useState } from "react";
import { useGuardaAdmin } from "@/components/GuardaAdmin";



interface Linha {
  cidade: { id: string; nome: string; estado: string } | null;
  categoria: { id: string; nome: string } | null;
  totalPesquisas: number;
  totalPrestadores: number;
  totalContatos: number;
  situacao: "boa" | "muita_oferta" | "faltam_prestadores";
}

const ROTULOS_SITUACAO: Record<Linha["situacao"], { texto: string; cor: string }> = {
  boa: { texto: "Boa", cor: "bg-relva-500/15 text-relva-600" },
  muita_oferta: { texto: "Muita oferta", cor: "bg-terra-500/15 text-terra-600" },
  faltam_prestadores: { texto: "Faltam prestadores", cor: "bg-red-500/15 text-red-600" },
};

export default function AdminOfertaDemandaPage() {
  const { sessao } = useGuardaAdmin();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!sessao) return;
    let ativo = true;
    setErro("");
    void fetchAutenticado("/api/admin/oferta-demanda", { cache: "no-store" })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error(`Não foi possível consultar oferta e demanda (HTTP ${resposta.status}).`);
        return resposta.json() as Promise<Linha[]>;
      })
      .then((resultado) => { if (ativo) setLinhas(resultado); })
      .catch((falha) => {
        if (ativo) setErro(falha instanceof Error ? falha.message : "Erro ao carregar oferta e demanda.");
      });
    return () => { ativo = false; };
  }, [sessao?.accessToken]);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-pinho-900">Oferta e demanda</h1>
      <p className="mt-2 text-pinho-700">Pesquisas, contatos gerados e prestadores ativos por cidade e serviço, nos últimos 30 dias.</p>
      {erro && <p role="alert" className="mt-3 text-terra-600">{erro}</p>}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-areia-300 bg-white/70">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-areia-300 text-xs uppercase tracking-wide text-pinho-700">
            <tr>
              <th className="px-4 py-3">Cidade</th>
              <th className="px-4 py-3">Serviço</th>
              <th className="px-4 py-3">Pesquisas</th>
              <th className="px-4 py-3">Prestadores</th>
              <th className="px-4 py-3">Contatos gerados</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {!linhas ? (
              <tr><td className="px-4 py-4 text-pinho-700" colSpan={6}>Carregando...</td></tr>
            ) : linhas.length === 0 ? (
              <tr><td className="px-4 py-4 text-pinho-700" colSpan={6}>Ainda não há dados suficientes. Volte quando houver mais pesquisas e contatos registrados.</td></tr>
            ) : (
              linhas.map((linha, i) => (
                <tr key={i} className="border-b border-areia-200">
                  <td className="px-4 py-3 font-medium text-pinho-900">{linha.cidade ? `${linha.cidade.nome}/${linha.cidade.estado}` : "-"}</td>
                  <td className="px-4 py-3 text-pinho-900">{linha.categoria?.nome ?? "-"}</td>
                  <td className="px-4 py-3 font-data text-pinho-900">{linha.totalPesquisas}</td>
                  <td className="px-4 py-3 font-data text-pinho-900">{linha.totalPrestadores}</td>
                  <td className="px-4 py-3 font-data text-pinho-900">{linha.totalContatos}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROTULOS_SITUACAO[linha.situacao].cor}`}>
                      {ROTULOS_SITUACAO[linha.situacao].texto}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
