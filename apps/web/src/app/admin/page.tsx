"use client";

import { useEffect, useState } from "react";
import { useGuardaAdmin } from "@/components/GuardaAdmin";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

interface Dashboard {
  hoje: { novosClientes: number; novosPrestadores: number; solicitacoes: number };
  geral: {
    totalClientes: number;
    totalPrestadores: number;
    prestadoresPublicados: number;
    prestadoresNaoPublicados: number;
    solicitacoesTotal: number;
    avaliacoesTotal: number;
    usuariosBloqueados: number;
  };
}

function Cartao({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <div className="rounded-2xl border border-areia-300 bg-white/70 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-pinho-700">{titulo}</p>
      <p className="mt-1 font-data text-3xl font-semibold text-pinho-900">{valor}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { sessao } = useGuardaAdmin();
  const [dados, setDados] = useState<Dashboard | null>(null);

  useEffect(() => {
    if (!sessao) return;
    fetch(`${API_URL}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${sessao.accessToken}` } })
      .then((r) => r.json())
      .then(setDados);
  }, [sessao]);

  if (!dados) return <p className="text-pinho-700">Carregando...</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-pinho-900">Dashboard</h1>

      <p className="mt-6 text-xs font-medium uppercase tracking-wide text-pinho-700">Hoje</p>
      <div className="mt-2 grid grid-cols-3 gap-4">
        <Cartao titulo="Novos clientes" valor={dados.hoje.novosClientes} />
        <Cartao titulo="Novos prestadores" valor={dados.hoje.novosPrestadores} />
        <Cartao titulo="Solicitacoes" valor={dados.hoje.solicitacoes} />
      </div>

      <p className="mt-8 text-xs font-medium uppercase tracking-wide text-pinho-700">Geral</p>
      <div className="mt-2 grid grid-cols-3 gap-4">
        <Cartao titulo="Total de clientes" valor={dados.geral.totalClientes} />
        <Cartao titulo="Total de prestadores" valor={dados.geral.totalPrestadores} />
        <Cartao titulo="Prestadores publicados" valor={dados.geral.prestadoresPublicados} />
        <Cartao titulo="Aguardando publicacao" valor={dados.geral.prestadoresNaoPublicados} />
        <Cartao titulo="Solicitacoes totais" valor={dados.geral.solicitacoesTotal} />
        <Cartao titulo="Avaliacoes totais" valor={dados.geral.avaliacoesTotal} />
      </div>

      {dados.geral.usuariosBloqueados > 0 && (
        <div className="mt-8 rounded-2xl border border-terra-500/30 bg-terra-500/10 p-5">
          <p className="font-medium text-terra-600">
            {dados.geral.usuariosBloqueados} usuario{dados.geral.usuariosBloqueados > 1 ? "s" : ""} bloqueado{dados.geral.usuariosBloqueados > 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
