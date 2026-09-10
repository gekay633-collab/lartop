"use client";

import { useEffect, useRef, useState } from "react";
import { enviarImagem } from "@/lib/upload";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

interface PerfilProprio {
  nomeExibicao: string;
  bio: string | null;
  fotoPerfilUrl: string | null;
  perfilPublicado: boolean;
  categorias: { categoria: { id: string; nome: string } }[];
  fotos: { id: string; urlDepois: string; descricao: string | null }[];
}

interface CategoriaDisponivel {
  id: string;
  nome: string;
  slug: string;
}

export function AbaMeuPerfil({ accessToken }: { accessToken: string }) {
  const [perfil, setPerfil] = useState<PerfilProprio | null>(null);
  const [bio, setBio] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [enviandoPortfolio, setEnviandoPortfolio] = useState(false);
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState<CategoriaDisponivel[]>([]);
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);
  const inputFotoPerfil = useRef<HTMLInputElement>(null);
  const inputPortfolio = useRef<HTMLInputElement>(null);

  async function carregar() {
    const [respostaPerfil, respostaCategorias] = await Promise.all([
      fetch(`${API_URL}/api/perfil/mim`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch(`${API_URL}/api/categorias`),
    ]);
    const dadosPerfil = await respostaPerfil.json();
    const dadosCategorias = await respostaCategorias.json();
    setPerfil(dadosPerfil);
    setBio(dadosPerfil.bio ?? "");
    setCategoriasSelecionadas(dadosPerfil.categorias.map((c: PerfilProprio["categorias"][number]) => c.categoria.id));
    setCategoriasDisponiveis(dadosCategorias);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvarBio() {
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const resposta = await fetch(`${API_URL}/api/perfil/mim`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ bio }),
      });
      if (!resposta.ok) throw new Error("Nao foi possivel salvar");
      setMensagem("Bio atualizada!");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  function alternarCategoria(id: string) {
    setCategoriasSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((c) => c !== id) : [...atual, id]
    );
  }

  async function salvarCategorias() {
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const resposta = await fetch(`${API_URL}/api/perfil/mim/categorias`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ categorias: categoriasSelecionadas.map((categoriaId) => ({ categoriaId })) }),
      });
      if (!resposta.ok) throw new Error("Nao foi possivel salvar as categorias");
      setMensagem("Categorias atualizadas!");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar categorias");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarPublicacao() {
    if (!perfil) return;
    setSalvando(true);
    setErro("");
    try {
      const acao = perfil.perfilPublicado ? "despublicar" : "publicar";
      const resposta = await fetch(`${API_URL}/api/perfil/mim/${acao}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Erro ao atualizar publicacao");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao atualizar publicacao");
    } finally {
      setSalvando(false);
    }
  }

  async function aoSelecionarFotoPerfil(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    setEnviandoFoto(true);
    setErro("");
    setMensagem("");
    try {
      const url = await enviarImagem(arquivo, accessToken);
      const resposta = await fetch(`${API_URL}/api/perfil/mim`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ fotoPerfilUrl: url }),
      });
      if (!resposta.ok) throw new Error("Nao foi possivel salvar a foto");
      setMensagem("Foto de perfil atualizada!");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar foto");
    } finally {
      setEnviandoFoto(false);
      if (inputFotoPerfil.current) inputFotoPerfil.current.value = "";
    }
  }

  async function aoSelecionarFotoPortfolio(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    setEnviandoPortfolio(true);
    setErro("");
    setMensagem("");
    try {
      const url = await enviarImagem(arquivo, accessToken);
      const resposta = await fetch(`${API_URL}/api/perfil/mim/fotos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ urlDepois: url }),
      });
      if (!resposta.ok) throw new Error("Nao foi possivel salvar a foto");
      setMensagem("Foto adicionada ao portfolio!");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar foto");
    } finally {
      setEnviandoPortfolio(false);
      if (inputPortfolio.current) inputPortfolio.current.value = "";
    }
  }

  if (!perfil) return <p className="text-pinho-700">Carregando...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-areia-300 bg-white/70 p-5">
        <p className="font-medium text-pinho-900">
          Status do perfil: {perfil.perfilPublicado ? "Publicado (visivel para clientes)" : "Nao publicado"}
        </p>
        <button
          onClick={alternarPublicacao}
          disabled={salvando}
          className={perfil.perfilPublicado ? "mt-3 rounded-lg border border-terra-500 px-4 py-2 text-sm font-medium text-terra-600 hover:bg-terra-500 hover:text-sauge-50" : "mt-3 rounded-lg bg-relva-500 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-relva-600"}
        >
          {perfil.perfilPublicado ? "Despublicar perfil" : "Publicar perfil"}
        </button>
      </div>

      <div className="rounded-2xl border border-areia-300 bg-white/70 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-pinho-700">Foto de perfil</p>
        <div className="mt-2 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-sauge-200">
            {perfil.fotoPerfilUrl ? (
              <img src={perfil.fotoPerfilUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl">🌱</span>
            )}
          </div>
          <div>
            <input ref={inputFotoPerfil} type="file" accept="image/*" onChange={aoSelecionarFotoPerfil} className="hidden" id="foto-perfil-input" />
            <label htmlFor="foto-perfil-input" className="cursor-pointer rounded-lg bg-pinho-900 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-pinho-700">
              {enviandoFoto ? "Enviando..." : "Trocar foto"}
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-areia-300 bg-white/70 p-5">
        <label className="text-xs font-medium uppercase tracking-wide text-pinho-700">Sobre voce</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
        <button onClick={salvarBio} disabled={salvando} className="mt-3 rounded-lg bg-pinho-900 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-pinho-700">
          Salvar bio
        </button>
      </div>

      <div className="rounded-2xl border border-areia-300 bg-white/70 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-pinho-700">Servicos que voce oferece</p>
        <div className="mt-2 flex flex-col gap-2">
          {categoriasDisponiveis.length === 0 ? (
            <p className="text-sm text-pinho-700">Carregando servicos disponiveis...</p>
          ) : (
            categoriasDisponiveis.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-pinho-900">
                <input type="checkbox" checked={categoriasSelecionadas.includes(c.id)} onChange={() => alternarCategoria(c.id)} />
                {c.nome}
              </label>
            ))
          )}
        </div>
        <button onClick={salvarCategorias} disabled={salvando} className="mt-3 rounded-lg bg-pinho-900 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-pinho-700">
          Salvar servicos
        </button>
      </div>

      <div className="rounded-2xl border border-areia-300 bg-white/70 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-pinho-700">Fotos de trabalhos realizados</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {perfil.fotos.map((foto) => (
            <img key={foto.id} src={foto.urlDepois} alt={foto.descricao ?? "Trabalho"} className="aspect-square rounded-lg object-cover" />
          ))}
        </div>
        <div className="mt-3">
          <input ref={inputPortfolio} type="file" accept="image/*" onChange={aoSelecionarFotoPortfolio} className="hidden" id="foto-portfolio-input" />
          <label htmlFor="foto-portfolio-input" className="inline-block cursor-pointer rounded-lg bg-pinho-900 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-pinho-700">
            {enviandoPortfolio ? "Enviando..." : "Adicionar foto"}
          </label>
        </div>
      </div>

      {mensagem && <p className="text-sm text-relva-600">{mensagem}</p>}
      {erro && <p className="text-sm text-terra-600">{erro}</p>}
    </div>
  );
}
