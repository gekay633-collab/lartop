"use client";

import { fetchAutenticado } from "@/lib/auth-client";

import { useEffect, useRef, useState } from "react";
import { enviarImagem } from "@/lib/upload";



interface PerfilProprio {
  nomeExibicao: string;
  bio: string | null;
  fotoPerfilUrl: string | null;
  perfilPublicado: boolean;
  usuario: { telefone: string | null; telefoneVerificado: boolean };
  categorias: { categoria: { id: string; nome: string } }[];
  fotos: { id: string; urlAntes: string | null; urlDepois: string; descricao: string | null }[];
}

interface CategoriaDisponivel {
  id: string;
  nome: string;
  slug: string;
}

export function AbaMeuPerfil({ accessToken }: { accessToken: string }) {
  const [perfil, setPerfil] = useState<PerfilProprio | null>(null);
  const [bio, setBio] = useState("");
  const [telefone, setTelefone] = useState("");
  const [salvandoTelefone, setSalvandoTelefone] = useState(false);
  const [erroTelefone, setErroTelefone] = useState("");
  const [mensagemTelefone, setMensagemTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [enviandoPortfolio, setEnviandoPortfolio] = useState(false);
  const [excluindoFotoId, setExcluindoFotoId] = useState<string | null>(null);
  const [fotoAntesSelecionada, setFotoAntesSelecionada] = useState<File | null>(null);
  const [fotoDepoisSelecionada, setFotoDepoisSelecionada] = useState<File | null>(null);
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState<CategoriaDisponivel[]>([]);
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);
  const [carregandoCategorias, setCarregandoCategorias] = useState(true);
  const [erroCategorias, setErroCategorias] = useState("");
  const [erroPerfil, setErroPerfil] = useState("");
  const inputFotoPerfil = useRef<HTMLInputElement>(null);
  const inputPortfolio = useRef<HTMLInputElement>(null);
  const inputPortfolioAntes = useRef<HTMLInputElement>(null);

  async function carregarPerfil() {
    try {
      const resposta = await fetchAutenticado("/api/perfil/mim", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!resposta.ok) throw new Error("Não foi possível carregar seu perfil.");
      const dados = (await resposta.json()) as PerfilProprio;
      if (!Array.isArray(dados.categorias) || !Array.isArray(dados.fotos)) {
        throw new Error("O servidor retornou um perfil incompleto.");
      }
      setPerfil(dados);
      setBio(dados.bio ?? "");
      setTelefone(dados.usuario?.telefone ?? "");
      setCategoriasSelecionadas(dados.categorias.map((c) => c.categoria.id));
      setErroPerfil("");
    } catch (err) {
      setErroPerfil(err instanceof Error ? err.message : "Erro ao carregar o perfil.");
    }
  }

  async function carregarCategorias() {
    setCarregandoCategorias(true);
    setErroCategorias("");
    try {
      const resposta = await fetch("/api/categorias", { cache: "no-store" });
      if (!resposta.ok) {
        throw new Error("Não foi possível consultar os serviços disponíveis.");
      }
      const dados: unknown = await resposta.json();
      if (
        !Array.isArray(dados) ||
        !dados.every((item) => (
          item && typeof item.id === "string" &&
          typeof item.nome === "string" && typeof item.slug === "string"
        ))
      ) {
        throw new Error("O servidor retornou uma lista de serviços inválida.");
      }
      setCategoriasDisponiveis(dados as CategoriaDisponivel[]);
    } catch (err) {
      setCategoriasDisponiveis([]);
      setErroCategorias(err instanceof Error ? err.message : "Erro ao carregar os serviços.");
    } finally {
      setCarregandoCategorias(false);
    }
  }

  async function carregar() {
    await Promise.all([carregarPerfil(), carregarCategorias()]);
  }

  useEffect(() => {
    void carregar();
  }, [accessToken]);

  async function salvarBio() {
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const resposta = await fetchAutenticado(`/api/perfil/mim`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ bio }),
      });
      if (!resposta.ok) throw new Error("Não foi possível salvar");
      setMensagem("Bio atualizada!");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarTelefone() {
    setErroTelefone("");
    setMensagemTelefone("");
    const digitos = telefone.replace(/\D/g, "");
    const numero = digitos.length === 13 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
    if (!/^[1-9]{2}9\d{8}$/.test(numero)) {
      setErroTelefone("Informe um celular com DDD, usando 11 dígitos. Ex.: 21999998888.");
      return;
    }

    setSalvandoTelefone(true);
    try {
      const resposta = await fetchAutenticado("/api/perfil/mim/telefone", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ telefone: numero }),
      });
      const dados: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        const mensagem = dados && typeof dados === "object" && "erro" in dados
          && typeof dados.erro === "string"
          ? dados.erro
          : `Não foi possível atualizar o celular (HTTP ${resposta.status}).`;
        throw new Error(mensagem);
      }
      if (!dados || typeof dados !== "object" || !("telefone" in dados)
        || typeof dados.telefone !== "string") {
        throw new Error("O servidor não confirmou o novo celular.");
      }
      setTelefone(dados.telefone);
      setMensagemTelefone("Celular atualizado! Os próximos contatos pelo WhatsApp usarão este número.");
    } catch (err) {
      setErroTelefone(err instanceof Error ? err.message : "Falha ao atualizar o celular.");
    } finally {
      setSalvandoTelefone(false);
    }
  }

  function alternarTodasCategorias() {
    const idsAtivos = categoriasDisponiveis.map((categoria) => categoria.id);
    const todosMarcados = idsAtivos.every((id) => categoriasSelecionadas.includes(id));
    setCategoriasSelecionadas(todosMarcados ? [] : idsAtivos);
    setErro("");
    setMensagem("");
  }

  function alternarCategoria(id: string) {
    setErro("");
    if (categoriasSelecionadas.includes(id)) {
      setCategoriasSelecionadas((atual) => atual.filter((categoria) => categoria !== id));
    } else {
      setCategoriasSelecionadas((atual) => [...atual, id]);
    }
  }

  async function salvarCategorias() {
    setErro("");
    setMensagem("");
    if (carregandoCategorias || erroCategorias || categoriasDisponiveis.length === 0) {
      setErro("Os serviços não estão disponíveis para seleção. Tente recarregar a lista.");
      return;
    }

    const idsDisponiveis = new Set(categoriasDisponiveis.map((categoria) => categoria.id));
    const categoriasValidas = categoriasSelecionadas.filter((id) => idsDisponiveis.has(id));
    if (categoriasValidas.length === 0) {
      setErro("Selecione pelo menos um serviço antes de salvar.");
      return;
    }
    setSalvando(true);
    try {
      const resposta = await fetchAutenticado("/api/perfil/mim/categorias", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ categorias: categoriasValidas.map((categoriaId) => ({ categoriaId })) }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        throw new Error(
          dados && typeof dados.erro === "string"
            ? dados.erro
            : `Não foi possível salvar os serviços (HTTP ${resposta.status}).`
        );
      }
      setMensagem("Serviços atualizados!");
      await carregarPerfil();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar os serviços.");
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
      const resposta = await fetchAutenticado(`/api/perfil/mim/${acao}`, {
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
      const resposta = await fetchAutenticado(`/api/perfil/mim`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ fotoPerfilUrl: url }),
      });
      if (!resposta.ok) throw new Error("Não foi possível salvar a foto");
      setMensagem("Foto de perfil atualizada!");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar foto");
    } finally {
      setEnviandoFoto(false);
      if (inputFotoPerfil.current) inputFotoPerfil.current.value = "";
    }
  }

  async function publicarTrabalho() {
    if (!perfil || !fotoDepoisSelecionada || enviandoPortfolio || excluindoFotoId) return;
    if (perfil.fotos.length >= 6) {
      setErro("O limite é de 6 trabalhos no portfólio. Exclua um para publicar outro.");
      return;
    }
    setEnviandoPortfolio(true);
    setErro("");
    setMensagem("");
    try {
      const urlAntes = fotoAntesSelecionada
        ? await enviarImagem(fotoAntesSelecionada, accessToken)
        : undefined;
      const urlDepois = await enviarImagem(fotoDepoisSelecionada, accessToken);
      const resposta = await fetchAutenticado("/api/perfil/mim/fotos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlAntes, urlDepois }),
      });
      if (!resposta.ok) {
        const dados: unknown = await resposta.json().catch(() => null);
        const mensagemErro = dados && typeof dados === "object" && "erro" in dados
          && typeof dados.erro === "string" ? dados.erro : "Não foi possível publicar as fotos.";
        throw new Error(mensagemErro);
      }
      await carregarPerfil();
      setFotoAntesSelecionada(null);
      setFotoDepoisSelecionada(null);
      if (inputPortfolio.current) inputPortfolio.current.value = "";
      if (inputPortfolioAntes.current) inputPortfolioAntes.current.value = "";
      setMensagem("Trabalho publicado no portfólio!");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao publicar as fotos.");
    } finally {
      setEnviandoPortfolio(false);
    }
  }

  async function excluirPublicacao(fotoId: string) {
    if (enviandoPortfolio || excluindoFotoId ||
      !window.confirm("Excluir este trabalho (fotos de antes e depois) do seu portfólio?")) return;
    setExcluindoFotoId(fotoId);
    setErro("");
    setMensagem("");
    try {
      const resposta = await fetchAutenticado(`/api/perfil/mim/fotos/${encodeURIComponent(fotoId)}`, {
        method: "DELETE",
      });
      if (!resposta.ok) {
        const dados: unknown = await resposta.json().catch(() => null);
        throw new Error(dados && typeof dados === "object" && "erro" in dados
          && typeof dados.erro === "string" ? dados.erro : "Não foi possível excluir o trabalho.");
      }
      await carregarPerfil();
      setMensagem("Publicação removida do portfólio.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao excluir o trabalho.");
    } finally {
      setExcluindoFotoId(null);
    }
  }

  if (!perfil) {
    return erroPerfil
      ? <p role="alert" className="text-terra-600">{erroPerfil}</p>
      : <p className="text-pinho-700">Carregando perfil...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-areia-300 bg-white/70 p-5">
        <p className="font-medium text-pinho-900">
          Status do perfil: {perfil.perfilPublicado ? "Publicado (visível para clientes)" : "Não publicado"}
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
        <h2 className="text-xs font-medium uppercase tracking-wide text-pinho-700">Meu celular / WhatsApp</h2>
        <p className="mt-2 text-sm text-pinho-700">
          Use seu número atual com DDD. Os clientes serão direcionados para ele ao solicitar orçamentos.
        </p>
        <form onSubmit={(evento) => { evento.preventDefault(); void salvarTelefone(); }} className="mt-3 flex flex-col gap-3">
          <label htmlFor="celular-profissional" className="text-sm text-pinho-900">Número para contato</label>
          <input
            id="celular-profissional"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(21) 99999-8888"
            value={telefone}
            onChange={(evento) => { setTelefone(evento.target.value); setMensagemTelefone(""); }}
            maxLength={20}
            required
            className="rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500"
          />
          <button type="submit" disabled={salvandoTelefone}
            className="self-start rounded-lg bg-pinho-900 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-pinho-700 disabled:opacity-60">
            {salvandoTelefone ? "Salvando..." : "Salvar celular"}
          </button>
          {erroTelefone && <p role="alert" className="text-sm text-terra-600">{erroTelefone}</p>}
          {mensagemTelefone && <p role="status" className="text-sm text-relva-600">{mensagemTelefone}</p>}
        </form>
      </div>

      <div className="rounded-2xl border border-areia-300 bg-white/70 p-5">
        <label className="text-xs font-medium uppercase tracking-wide text-pinho-700">Sobre você</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
        <button onClick={salvarBio} disabled={salvando} className="mt-3 rounded-lg bg-pinho-900 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-pinho-700">
          Salvar bio
        </button>
      </div>

      <div className="rounded-2xl border border-areia-300 bg-white/70 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-pinho-700">Serviços que você oferece</p>
        <div className="mt-2 flex flex-col gap-2">
          {carregandoCategorias ? (
            <p className="text-sm text-pinho-700">Carregando serviços disponíveis...</p>
          ) : erroCategorias ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-terra-600">{erroCategorias}</p>
              <button type="button" onClick={() => void carregarCategorias()} className="text-sm font-medium text-relva-600 hover:underline">
                Tentar novamente
              </button>
            </div>
          ) : categoriasDisponiveis.length === 0 ? (
            <p role="status" className="text-sm text-terra-600">
              Nenhum serviço ativo disponível. O administrador precisa cadastrar ou ativar
              categorias no painel administrativo.
            </p>
          ) : (
            <>
              <label className="flex items-center gap-2 border-b border-areia-300 pb-2 font-medium text-pinho-900">
                <input
                  type="checkbox"
                  checked={categoriasDisponiveis.every((c) => categoriasSelecionadas.includes(c.id))}
                  onChange={alternarTodasCategorias}
                />
                Selecionar todos os serviços
              </label>
              {categoriasDisponiveis.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-pinho-900">
                  <input type="checkbox" checked={categoriasSelecionadas.includes(c.id)} onChange={() => alternarCategoria(c.id)} />
                  {c.nome}
                </label>
              ))}
              <p className="text-xs text-pinho-700">
                {categoriasDisponiveis.filter((c) => categoriasSelecionadas.includes(c.id)).length} de {categoriasDisponiveis.length} serviços selecionados
              </p>
            </>
          )}
        </div>
        <button onClick={salvarCategorias} disabled={salvando || carregandoCategorias || Boolean(erroCategorias) || categoriasDisponiveis.length === 0 || categoriasSelecionadas.length === 0} className="mt-3 rounded-lg bg-pinho-900 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-pinho-700 disabled:cursor-not-allowed disabled:opacity-50">
          Salvar serviços
        </button>
      </div>

      <div className="rounded-2xl border border-areia-300 bg-white/70 p-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-pinho-700">Fotos de trabalhos realizados</h2>
        <p className="mt-1 text-sm text-pinho-700">
          {perfil.fotos.length} de 6 trabalhos publicados. Cada trabalho pode ter fotos de antes e depois.
        </p>
        {perfil.fotos.length === 0 ? (
          <p className="mt-3 text-sm text-pinho-700">Você ainda não publicou trabalhos no portfólio.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {perfil.fotos.map((foto) => (
              <div key={foto.id} className="rounded-xl border border-areia-300 p-3">
                <div className="grid grid-cols-2 gap-2">
                  {foto.urlAntes ? (
                    <figure>
                      <img src={foto.urlAntes} alt="Antes do serviço" className="aspect-square w-full rounded-lg object-cover" />
                      <figcaption className="mt-1 text-xs text-pinho-700">Antes</figcaption>
                    </figure>
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-lg bg-sauge-100 text-xs text-pinho-700">
                      Sem foto de antes
                    </div>
                  )}
                  <figure>
                    <img src={foto.urlDepois} alt="Depois do serviço" className="aspect-square w-full rounded-lg object-cover" />
                    <figcaption className="mt-1 text-xs text-pinho-700">Depois</figcaption>
                  </figure>
                </div>
                {foto.descricao && <p className="mt-2 text-sm text-pinho-700">{foto.descricao}</p>}
                <button
                  type="button"
                  onClick={() => void excluirPublicacao(foto.id)}
                  disabled={Boolean(excluindoFotoId) || enviandoPortfolio}
                  className="mt-3 rounded-lg border border-terra-500 px-3 py-2 text-sm font-medium text-terra-600 hover:bg-terra-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Excluir este trabalho do portfólio"
                >
                  {excluindoFotoId === foto.id ? "Excluindo..." : "Excluir publicação"}
                </button>
              </div>
            ))}
          </div>
        )}
        {perfil.fotos.length < 6 ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-areia-300 pt-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-pinho-900">
              Foto de antes (opcional)
              <input
                ref={inputPortfolioAntes}
                type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(evento) => setFotoAntesSelecionada(evento.target.files?.[0] ?? null)}
                disabled={enviandoPortfolio || Boolean(excluindoFotoId)}
                className="text-sm font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-pinho-900">
              Foto de depois
              <input
                ref={inputPortfolio}
                type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(evento) => setFotoDepoisSelecionada(evento.target.files?.[0] ?? null)}
                disabled={enviandoPortfolio || Boolean(excluindoFotoId)}
                className="text-sm font-normal"
              />
            </label>
            <button
              type="button"
              onClick={() => void publicarTrabalho()}
              disabled={!fotoDepoisSelecionada || enviandoPortfolio || Boolean(excluindoFotoId)}
              className="self-start rounded-lg bg-pinho-900 px-4 py-2 text-sm font-medium text-sauge-50 hover:bg-pinho-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviandoPortfolio ? "Publicando..." : "Publicar trabalho"}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm font-medium text-terra-600">
            Limite de 6 trabalhos atingido. Exclua uma publicação para adicionar outra.
          </p>
        )}
      </div>

      {mensagem && <p className="text-sm text-relva-600">{mensagem}</p>}
      {erro && <p className="text-sm text-terra-600">{erro}</p>}
    </div>
  );
}
