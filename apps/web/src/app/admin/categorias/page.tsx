"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useGuardaAdmin } from "@/components/GuardaAdmin";

interface Servico {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  _count: { profissionais: number };
}

function gerarSlug(nome: string): string {
  return nome.trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function lerErro(resposta: Response): Promise<string> {
  const dados: unknown = await resposta.json().catch(() => null);
  if (dados && typeof dados === "object" && "erro" in dados && typeof dados.erro === "string") {
    return dados.erro;
  }
  return `Não foi possível concluir a operação (HTTP ${resposta.status}).`;
}

export default function AdminServicosPage() {
  const { sessao } = useGuardaAdmin();
  const [servicos, setServicos] = useState<Servico[] | null>(null);
  const [nomeNovo, setNomeNovo] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");

  const cabecalhos = sessao ? {
    Authorization: `Bearer ${sessao.accessToken}`,
    "Content-Type": "application/json",
  } : {};

  async function carregar() {
    if (!sessao) return;
    const resposta = await fetch("/api/admin/categorias", {
      headers: { Authorization: `Bearer ${sessao.accessToken}` },
      cache: "no-store",
    });
    if (!resposta.ok) throw new Error(await lerErro(resposta));
    const dados: unknown = await resposta.json();
    if (!Array.isArray(dados)) throw new Error("O servidor retornou um catálogo inválido.");
    setServicos(dados as Servico[]);
  }

  useEffect(() => {
    if (!sessao) return;
    void carregar().catch((falha) => {
      setErro(falha instanceof Error ? falha.message : "Erro ao carregar os serviços.");
      setServicos([]);
    });
  }, [sessao?.accessToken]);

  async function cadastrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!sessao || salvando) return;
    const nome = nomeNovo.trim();
    const slug = gerarSlug(nome);
    if (nome.length < 2 || nome.length > 80 || slug.length < 2 || slug.length > 80) {
      setErro("Informe um serviço com nome válido de 2 a 80 caracteres.");
      return;
    }
    setErro("");
    setMensagem("");
    setSalvando(true);
    try {
      const resposta = await fetch("/api/admin/categorias", {
        method: "POST",
        headers: cabecalhos,
        body: JSON.stringify({ nome, slug }),
      });
      if (!resposta.ok) throw new Error(await lerErro(resposta));
      setNomeNovo("");
      setMensagem("Serviço cadastrado! Ele já aparece para os prestadores.");
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível cadastrar o serviço.");
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarIniciais() {
    if (!sessao || salvando) return;
    setErro("");
    setMensagem("");
    setSalvando(true);
    try {
      const resposta = await fetch("/api/admin/categorias/iniciais", {
        method: "POST",
        headers: cabecalhos,
      });
      if (!resposta.ok) throw new Error(await lerErro(resposta));
      const dados = await resposta.json() as { adicionados: number };
      setMensagem(`${dados.adicionados} serviço(s) adicionado(s). Os já cadastrados foram preservados.`);
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível cadastrar os serviços iniciais.");
    } finally {
      setSalvando(false);
    }
  }

  async function atualizar(id: string, alteracoes: { ativo?: boolean; nome?: string }) {
    if (!sessao || salvando) return;
    setErro("");
    setMensagem("");
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/admin/categorias/${id}`, {
        method: "PATCH",
        headers: cabecalhos,
        body: JSON.stringify(alteracoes),
      });
      if (!resposta.ok) throw new Error(await lerErro(resposta));
      setEditandoId(null);
      setMensagem("Serviço atualizado.");
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível atualizar o serviço.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl font-semibold text-pinho-900">Serviços da Lartop</h1>
      <p className="mt-2 text-sm text-pinho-700">
        Cadastre os serviços oferecidos na plataforma. Os prestadores escolhem um, vários ou todos
        os serviços ativos no próprio perfil.
      </p>

      <section className="mt-6 rounded-2xl border border-areia-300 bg-white/70 p-5">
        <h2 className="font-display text-lg font-semibold text-pinho-900">Cadastrar novo serviço</h2>
        <form onSubmit={cadastrar} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="nome-servico" className="sr-only">Nome do serviço</label>
          <input
            id="nome-servico" value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)}
            placeholder="Ex.: Limpeza de piscina" required minLength={2} maxLength={80}
            className="w-full max-w-md rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900"
          />
          <button type="submit" disabled={salvando}
            className="rounded-lg bg-relva-500 px-4 py-2 font-semibold text-sauge-50 disabled:opacity-50">
            Cadastrar serviço
          </button>
        </form>
        <div className="mt-5 border-t border-areia-300 pt-4">
          <p className="text-sm text-pinho-700">
            Quer começar com Corte de grama, Poda, Paisagismo, Manutenção de jardim,
            Limpeza de terreno, Instalação de grama e Piscineiro?
          </p>
          <button type="button" onClick={adicionarIniciais} disabled={salvando}
            className="mt-3 rounded-lg border border-pinho-900 px-4 py-2 text-sm font-semibold text-pinho-900 disabled:opacity-50">
            Adicionar 7 serviços iniciais
          </button>
        </div>
      </section>

      {erro && <p role="alert" className="mt-4 text-sm text-terra-600">{erro}</p>}
      {mensagem && <p role="status" className="mt-4 text-sm text-relva-600">{mensagem}</p>}

      <section className="mt-6 overflow-x-auto rounded-2xl border border-areia-300 bg-white/70">
        <h2 className="px-4 py-4 font-display text-lg font-semibold text-pinho-900">Catálogo de serviços</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-areia-300 text-xs uppercase tracking-wide text-pinho-700">
            <tr>
              <th className="px-4 py-3">Serviço</th>
              <th className="px-4 py-3">Prestadores</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {servicos === null ? (
              <tr><td colSpan={4} className="px-4 py-5 text-pinho-700">Carregando serviços...</td></tr>
            ) : servicos.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-5 text-pinho-700">
                Ainda não há serviços cadastrados. Cadastre um serviço ou adicione os iniciais acima.
              </td></tr>
            ) : servicos.map((servico) => (
              <tr key={servico.id} className="border-t border-areia-200">
                <td className="px-4 py-3">
                  {editandoId === servico.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        aria-label="Novo nome do serviço" value={nomeEdicao}
                        onChange={(e) => setNomeEdicao(e.target.value)}
                        maxLength={80}
                        className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900"
                      />
                      <div className="flex gap-2">
                        <button type="button" disabled={salvando || nomeEdicao.trim().length < 2}
                          onClick={() => void atualizar(servico.id, { nome: nomeEdicao.trim() })}
                          className="text-relva-600 disabled:opacity-50">Salvar</button>
                        <button type="button" disabled={salvando} onClick={() => setEditandoId(null)}
                          className="text-pinho-700">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-pinho-900">{servico.nome}</p>
                      <p className="text-xs text-pinho-700">{servico.slug}</p>
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-pinho-900">{servico._count.profissionais}</td>
                <td className="px-4 py-3 text-pinho-900">{servico.ativo ? "Ativo" : "Inativo"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-3">
                    <button type="button" disabled={salvando}
                      onClick={() => { setEditandoId(servico.id); setNomeEdicao(servico.nome); }}
                      className="text-pinho-900 underline disabled:opacity-50">Editar</button>
                    <button type="button" disabled={salvando}
                      onClick={() => void atualizar(servico.id, { ativo: !servico.ativo })}
                      className="text-relva-600 underline disabled:opacity-50">
                      {servico.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
