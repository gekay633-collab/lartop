"use client";

import { useEffect, useState } from "react";
import { useGuardaAdmin } from "@/components/GuardaAdmin";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

interface Prestador {
  usuarioId: string;
  nomeExibicao: string;
  perfilPublicado: boolean;
  criadoEm: string;
  usuario: { email: string; telefone: string | null; ativo: boolean };
  cidade: { nome: string; estado: string };
  _count: { fotos: number; categorias: number };
}

export default function AdminPrestadoresPage() {
  const { sessao } = useGuardaAdmin();
  const [prestadores, setPrestadores] = useState<Prestador[] | null>(null);
  const [busca, setBusca] = useState("");

  async function carregar() {
    if (!sessao) return;
    const query = new URLSearchParams();
    if (busca) query.set("busca", busca);
    const resposta = await fetch(`${API_URL}/api/admin/prestadores?${query.toString()}`, {
      headers: { Authorization: `Bearer ${sessao.accessToken}` },
    });
    const dados = await resposta.json();
    setPrestadores(dados.itens);
  }

  useEffect(() => {
    carregar();
  }, [sessao]);

  async function alternarPublicacao(id: string, publicado: boolean) {
    if (!sessao) return;
    await fetch(`${API_URL}/api/admin/prestadores/${id}/publicacao`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessao.accessToken}` },
      body: JSON.stringify({ publicado }),
    });
    carregar();
  }

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
      <h1 className="font-display text-2xl font-semibold text-pinho-900">Prestadores</h1>

      <div className="mt-4 flex gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail" className="w-full max-w-sm rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
        <button onClick={carregar} className="rounded-lg bg-pinho-900 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-pinho-700">Buscar</button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-areia-300 bg-white/70">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-areia-300 text-xs uppercase tracking-wide text-pinho-700">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Cidade</th>
              <th className="px-4 py-3">Servicos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Conta</th>
              <th className="px-4 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {!prestadores ? (
              <tr><td className="px-4 py-4 text-pinho-700" colSpan={6}>Carregando...</td></tr>
            ) : prestadores.length === 0 ? (
              <tr><td className="px-4 py-4 text-pinho-700" colSpan={6}>Nenhum prestador encontrado.</td></tr>
            ) : (
              prestadores.map((p) => (
                <tr key={p.usuarioId} className="border-b border-areia-200">
                  <td className="px-4 py-3">
                    <p className="font-medium text-pinho-900">{p.nomeExibicao}</p>
                    <p className="text-xs text-pinho-700">{p.usuario.email}</p>
                  </td>
                  <td className="px-4 py-3 text-pinho-900">{p.cidade.nome}/{p.cidade.estado}</td>
                  <td className="px-4 py-3 text-pinho-900">{p._count.categorias}</td>
                  <td className="px-4 py-3">
                    <span className={p.perfilPublicado ? "rounded-full bg-relva-500/15 px-2 py-0.5 text-xs font-medium text-relva-600" : "rounded-full bg-areia-200 px-2 py-0.5 text-xs font-medium text-pinho-700"}>
                      {p.perfilPublicado ? "Publicado" : "Nao publicado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={p.usuario.ativo ? "rounded-full bg-relva-500/15 px-2 py-0.5 text-xs font-medium text-relva-600" : "rounded-full bg-terra-500/15 px-2 py-0.5 text-xs font-medium text-terra-600"}>
                      {p.usuario.ativo ? "Ativa" : "Bloqueada"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => alternarPublicacao(p.usuarioId, !p.perfilPublicado)} className="rounded-lg border border-relva-500 px-2 py-1 text-xs font-medium text-relva-600 hover:bg-relva-500 hover:text-sauge-50">
                        {p.perfilPublicado ? "Despublicar" : "Aprovar"}
                      </button>
                      <button onClick={() => alternarBloqueio(p.usuarioId, !p.usuario.ativo)} className="rounded-lg border border-terra-500 px-2 py-1 text-xs font-medium text-terra-600 hover:bg-terra-500 hover:text-sauge-50">
                        {p.usuario.ativo ? "Bloquear" : "Desbloquear"}
                      </button>
                    </div>
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
