"use client";

import { useEffect, useState } from "react";
import { useGuardaAdmin } from "@/components/GuardaAdmin";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  criadoEm: string;
  _count: { solicitacoesFeitas: number };
}

export default function AdminClientesPage() {
  const { sessao } = useGuardaAdmin();
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [busca, setBusca] = useState("");

  async function carregar() {
    if (!sessao) return;
    const query = new URLSearchParams();
    if (busca) query.set("busca", busca);
    const resposta = await fetch(`${API_URL}/api/admin/clientes?${query.toString()}`, {
      headers: { Authorization: `Bearer ${sessao.accessToken}` },
    });
    const dados = await resposta.json();
    setClientes(dados.itens);
  }

  useEffect(() => {
    carregar();
  }, [sessao]);

  async function alternarBloqueio(id: string, ativo: boolean) {
    if (!sessao) return;
    await fetch(`${API_URL}/api/admin/usuarios/${id}/bloqueio`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessao.accessToken}` },
      body: JSON.stringify({ ativo }),
    });
    carregar();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-pinho-900">Clientes</h1>

      <div className="mt-4 flex gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail" className="w-full max-w-sm rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
        <button onClick={carregar} className="rounded-lg bg-pinho-900 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-pinho-700">Buscar</button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-areia-300 bg-white/70">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-areia-300 text-xs uppercase tracking-wide text-pinho-700">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Contato</th>
              <th className="px-4 py-3">Solicitacoes feitas</th>
              <th className="px-4 py-3">Conta</th>
              <th className="px-4 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {!clientes ? (
              <tr><td className="px-4 py-4 text-pinho-700" colSpan={5}>Carregando...</td></tr>
            ) : clientes.length === 0 ? (
              <tr><td className="px-4 py-4 text-pinho-700" colSpan={5}>Nenhum cliente encontrado.</td></tr>
            ) : (
              clientes.map((c) => (
                <tr key={c.id} className="border-b border-areia-200">
                  <td className="px-4 py-3 font-medium text-pinho-900">{c.nome}</td>
                  <td className="px-4 py-3 text-pinho-900">
                    <p>{c.email}</p>
                    {c.telefone && <p className="text-xs text-pinho-700">{c.telefone}</p>}
                  </td>
                  <td className="px-4 py-3 font-data text-pinho-900">{c._count.solicitacoesFeitas}</td>
                  <td className="px-4 py-3">
                    <span className={c.ativo ? "rounded-full bg-relva-500/15 px-2 py-0.5 text-xs font-medium text-relva-600" : "rounded-full bg-terra-500/15 px-2 py-0.5 text-xs font-medium text-terra-600"}>
                      {c.ativo ? "Ativa" : "Bloqueada"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => alternarBloqueio(c.id, !c.ativo)} className="rounded-lg border border-terra-500 px-2 py-1 text-xs font-medium text-terra-600 hover:bg-terra-500 hover:text-sauge-50">
                      {c.ativo ? "Bloquear" : "Desbloquear"}
                    </button>
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
