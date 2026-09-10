"use client";

import { useEffect, useState } from "react";
import { obterSessao, entrar, registrarComoCliente, type SessaoLocal } from "@/lib/auth-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

interface Categoria {
  id: string;
  categoria: { id: string; nome: string; slug: string };
}

export function FormularioSolicitacao({ profissionalId, profissionalNome, categorias }: { profissionalId: string; profissionalNome: string; categorias: Categoria[] }) {
  const [sessao, setSessao] = useState<SessaoLocal | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  useEffect(() => {
    setSessao(obterSessao());
    setCarregandoSessao(false);
  }, []);

  if (carregandoSessao) {
    return <p className="text-pinho-700">Carregando...</p>;
  }

  if (!sessao) {
    return <AcessoRapido onEntrou={setSessao} />;
  }

  if (sessao.tipo !== "CLIENTE") {
    return (
      <div className="rounded-2xl border border-terra-500/30 bg-terra-500/10 p-6">
        <p className="font-medium text-terra-600">Essa conta e de profissional. Para pedir um orcamento, entre com uma conta de cliente.</p>
      </div>
    );
  }

  return <FormularioPedido profissionalId={profissionalId} profissionalNome={profissionalNome} categorias={categorias} accessToken={sessao.accessToken} />;
}

function AcessoRapido({ onEntrou }: { onEntrou: (s: SessaoLocal) => void }) {
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const sessao = modo === "entrar" ? await entrar(email, senha) : await registrarComoCliente({ nome, email, senha, telefone: telefone || undefined });
      onEntrou(sessao);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Algo deu errado");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-areia-300 bg-white/70 p-6">
      <div className="mb-4 flex gap-4 border-b border-areia-300">
        <button type="button" onClick={() => setModo("entrar")} className={modo === "entrar" ? "pb-3 text-sm font-medium border-b-2 border-relva-500 text-pinho-900" : "pb-3 text-sm font-medium text-pinho-700"}>Ja tenho conta</button>
        <button type="button" onClick={() => setModo("cadastrar")} className={modo === "cadastrar" ? "pb-3 text-sm font-medium border-b-2 border-relva-500 text-pinho-900" : "pb-3 text-sm font-medium text-pinho-700"}>Criar conta</button>
      </div>

      <form onSubmit={aoSubmeter} className="flex flex-col gap-3">
        {modo === "cadastrar" && (
          <input type="text" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
        )}
        <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
        <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
        {modo === "cadastrar" && (
          <input type="tel" placeholder="Telefone (opcional)" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
        )}

        {erro && <p className="text-sm text-terra-600">{erro}</p>}

        <button type="submit" disabled={carregando} className="rounded-lg bg-relva-500 px-4 py-2 font-semibold text-sauge-50 transition hover:bg-relva-600 disabled:opacity-60">
          {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta e continuar"}
        </button>
      </form>
    </div>
  );
}

function FormularioPedido({ profissionalId, profissionalNome, categorias, accessToken }: { profissionalId: string; profissionalNome: string; categorias: Categoria[]; accessToken: string }) {
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.categoria.id ?? "");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [tamanhoM2, setTamanhoM2] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [linkWhatsapp, setLinkWhatsapp] = useState("");

  async function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch(`${API_URL}/api/solicitacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ profissionalId, categoriaId, cep: cep.replace(/\D/g, ""), endereco, tamanhoM2: Number(tamanhoM2), descricao: descricao || undefined }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro ?? "Nao foi possivel enviar a solicitacao");
      }
      setLinkWhatsapp(dados.linkWhatsapp);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Algo deu errado");
    } finally {
      setCarregando(false);
    }
  }

  if (linkWhatsapp) {
    return (
      <div className="rounded-2xl border border-relva-500/40 bg-relva-500/10 p-6 text-center">
        <p className="font-display text-lg font-semibold text-pinho-900">Solicitacao enviada!</p>
        <p className="mt-2 text-pinho-700">Agora e so falar com {profissionalNome} pelo WhatsApp para combinar os detalhes.</p>
        <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-xl bg-relva-500 px-6 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600">Abrir WhatsApp</a>
      </div>
    );
  }

  return (
    <form onSubmit={aoSubmeter} className="flex flex-col gap-3 rounded-2xl border border-areia-300 bg-white/70 p-6">
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-pinho-700">Servico</label>
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500">
          {categorias.map((c) => (
            <option key={c.categoria.id} value={c.categoria.id}>{c.categoria.nome}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-pinho-700">Seu CEP</label>
        <input type="text" value={cep} onChange={(e) => setCep(e.target.value)} required placeholder="00000-000" className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-2 font-data text-pinho-900 outline-none focus:border-relva-500" />
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-pinho-700">Endereco completo</label>
        <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} required placeholder="Rua, numero, bairro" className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-pinho-700">Tamanho aproximado (m2)</label>
        <input type="number" value={tamanhoM2} onChange={(e) => setTamanhoM2(e.target.value)} required min={1} placeholder="Ex: 100" className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-2 font-data text-pinho-900 outline-none focus:border-relva-500" />
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-pinho-700">Detalhes (opcional)</label>
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Conte mais sobre o servico que precisa" className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
      </div>

      {erro && <p className="text-sm text-terra-600">{erro}</p>}

      <button type="submit" disabled={carregando} className="mt-2 rounded-xl bg-relva-500 px-4 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600 disabled:opacity-60">
        {carregando ? "Enviando..." : "Enviar e gerar link do WhatsApp"}
      </button>
    </form>
  );
}
