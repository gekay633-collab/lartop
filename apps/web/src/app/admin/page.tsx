"use client";

import { fetchAutenticado } from "@/lib/auth-client";
import Link from "next/link";

import { useEffect, useState } from "react";
import { useGuardaAdmin } from "@/components/GuardaAdmin";



interface Dashboard {
  hoje: { novosClientes: number; novosPrestadores: number; solicitacoes: number };
  geral: {
    totalClientes: number;
    totalPrestadores: number;
    prestadoresPublicados: number;
    prestadoresNaoPublicados: number;
    solicitacoesTotal: number;
    avaliacoesTotal: number;
    feedbacksClientesTotal: number;
    usuariosBloqueados: number;
  };
  ultimos30dias: {
    pedidosRecebidos: number;
    pedidosSemCadastro: number;
    concluidosInformados: number;
    feedbacksClientes: number;
    feedbacksVisitantes: number;
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
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!sessao) return;
    let ativo = true;
    setErro("");
    void fetchAutenticado("/api/admin/dashboard", { cache: "no-store" })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error(`Não foi possível consultar o painel (HTTP ${resposta.status}).`);
        return resposta.json() as Promise<Dashboard>;
      })
      .then((resultado) => { if (ativo) setDados(resultado); })
      .catch((falha) => {
        if (ativo) setErro(falha instanceof Error ? falha.message : "Erro ao carregar o painel.");
      });
    return () => { ativo = false; };
  }, [sessao?.accessToken]);

  if (erro) return <p role="alert" className="text-terra-600">{erro}</p>;
  if (!dados) return <p className="text-pinho-700">Carregando...</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-pinho-900">Dashboard</h1>

      <p className="mt-6 text-xs font-medium uppercase tracking-wide text-pinho-700">Hoje</p>
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Cartao titulo="Novos prestadores" valor={dados.hoje.novosPrestadores} />
        <Cartao titulo="Solicitações recebidas" valor={dados.hoje.solicitacoes} />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-pinho-700">Atendimento — últimos 30 dias</p>
        <Link href="/admin/resultados" className="rounded-lg border border-relva-500 px-3 py-2 text-sm font-semibold text-relva-600">
          Ver resultados por prestador
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Cartao titulo="Pedidos recebidos" valor={dados.ultimos30dias.pedidosRecebidos} />
        <Cartao titulo="Pedidos sem cadastro" valor={dados.ultimos30dias.pedidosSemCadastro} />
        <Cartao titulo="Concluídos informados" valor={dados.ultimos30dias.concluidosInformados} />
        <Cartao titulo="Feedbacks de clientes" valor={dados.ultimos30dias.feedbacksClientes} />
        <Cartao titulo="Feedbacks sem cadastro" valor={dados.ultimos30dias.feedbacksVisitantes} />
      </div>
      <p className="mt-3 text-xs text-pinho-700">
        Concluído = status declarado pelo prestador. Não significa pagamento ou contratação confirmada.
        Os feedbacks são contados pela data do envio, e os pedidos pela data de criação.
      </p>

      <p className="mt-8 text-xs font-medium uppercase tracking-wide text-pinho-700">Geral</p>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Cartao titulo="Total de prestadores" valor={dados.geral.totalPrestadores} />
        <Cartao titulo="Prestadores publicados" valor={dados.geral.prestadoresPublicados} />
        <Cartao titulo="Aguardando publicação" valor={dados.geral.prestadoresNaoPublicados} />
        <Cartao titulo="Solicitações totais" valor={dados.geral.solicitacoesTotal} />
        <Cartao titulo="Avaliações registradas" valor={dados.geral.avaliacoesTotal} />
        <Cartao titulo="Feedbacks de clientes" valor={dados.geral.feedbacksClientesTotal} />
      </div>

      {dados.geral.usuariosBloqueados > 0 && (
        <div className="mt-8 rounded-2xl border border-terra-500/30 bg-terra-500/10 p-5">
          <p className="font-medium text-terra-600">
            {dados.geral.usuariosBloqueados} usuário{dados.geral.usuariosBloqueados > 1 ? "s" : ""} bloqueado{dados.geral.usuariosBloqueados > 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
