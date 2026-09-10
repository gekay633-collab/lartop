"use client";

import { useEffect, useState } from "react";
import { useGuardaAdmin } from "@/components/GuardaAdmin";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

interface Categoria {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  _count: { profissionais: number };
}

function gerarSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminCategoriasPage() {
  const { sessao } = useGuardaAdmin();
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [nomeNova, setNomeNova] = useState("");
  const [erro, setErro] = useState("");

  async function carregar() {
    if (!sessao) return;
    const resposta = await fetch(`${API_URL}/api/admin/categorias`, {
      headers: { Authorization: `Bearer ${sessao.accessToken}` },
    });
    setCategorias(await resposta.json());
  }

  useEffect(() => {
    carregar();
  }, [sessao]);

  async function criar() {
    if (!sessao || !nomeNova.trim()) return;
    setErro("");
    const resposta = await fetch(`${API_URL}/api/admin/categorias`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessao.accessToken}` },
      body: JSON.stringify({ nome: nomeNova, slug: gerarSlug(nomeNova) }),
    });
    if (!resposta.ok) {
      const dados = await resposta.json();
      setErro(dados.erro ?? "Nao foi possivel criar");
      return;
    }
    setNomeNova("");
    carregar();
  }

  async function alternarAtivo(id: string, ativo: boolean) {
    if (!sessao) return;
    await fetch(`${API_URL}/api/admin/categorias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessao.accessToken}` },
      body: JSON.stringify({ ativo }),
    });
    carregar();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-pinho-900">Categorias</h1>

      <div className="mt-4 flex gap-2">
        <input value={nomeNova} onChange={(e) => setNomeNova(e.target.value)} placeholder="Nome da nova categoria" className="w-full max-w-sm rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
        <button onClick={criar} className="rounded-lg bg-relva-500 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-relva-600">Criar categoria</button>
      </div>
      {erro && <p className="mt-2 text-sm text-terra-600">{erro}</p>}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-areia-300 bg-white/70">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-areia-300 text-xs uppercase tracking-wide text-pinho-700">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Prestadores</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {!categorias ? (
              <tr><td className="px-4 py-4 text-pinho-700" colSpan={5}>Carregando...</td></tr>
            ) : (
              categorias.map((c) => (
                <tr key={c.id} className="border-b border-areia-200">
                  <td className="px-4 py-3 font-medium text-pinho-900">{c.nome}</td>
                  <td className="px-4 py-3 font-data text-pinho-700">{c.slug}</td>
                  <td className="px-4 py-3 text-pinho-900">{c._count.profissionais}</td>
                  <td className="px-4 py-3">
                    <span className={c.ativo ? "rounded-full bg-relva-500/15 px-2 py-0.5 text-xs font-medium text-relva-600" : "rounded-full bg-areia-200 px-2 py-0.5 text-xs font-medium text-pinho-700"}>
                      {c.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => alternarAtivo(c.id, !c.ativo)} className="rounded-lg border border-pinho-900 px-2 py-1 text-xs font-medium text-pinho-900 hover:bg-pinho-900 hover:text-sauge-50">
                      {c.ativo ? "Desativar" : "Ativar"}
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
