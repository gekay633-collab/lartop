"use client";

import { useEffect, useRef, useState } from "react";
import { restaurarSessao, entrar, registrarComoCliente, fetchAutenticado, type SessaoLocal } from "@/lib/auth-client";



// O armazenamento contém somente UUID e SHA-256 dos dados, nunca endereço,
// descrição ou credenciais. A tentativa sobrevive a timeout/reload da aba.
const CHAVE_REENVIO = "lartop:solicitacao-pendente:v1";
async function chaveDaTentativa(corpo: string): Promise<string> {
  const hashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(corpo));
  const resumo = [...new Uint8Array(hashBytes)].map(b => b.toString(16).padStart(2, "0")).join("");
  try {
    const anterior: unknown = JSON.parse(sessionStorage.getItem(CHAVE_REENVIO) || "null");
    if (anterior && typeof anterior === "object" &&
        "resumo" in anterior && anterior.resumo === resumo &&
        "chave" in anterior && typeof anterior.chave === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(anterior.chave)) {
      return anterior.chave;
    }
  } catch { /* storage desabilitado: a proteção no servidor permanece */ }
  const chave = crypto.randomUUID();
  try { sessionStorage.setItem(CHAVE_REENVIO, JSON.stringify({ resumo, chave })); } catch { /* opcional */ }
  return chave;
}
function finalizarTentativa(chave: string): void {
  try {
    const salvo: unknown = JSON.parse(sessionStorage.getItem(CHAVE_REENVIO) || "null");
    if (salvo && typeof salvo === "object" && "chave" in salvo && salvo.chave === chave) {
      sessionStorage.removeItem(CHAVE_REENVIO);
    }
  } catch { /* opcional */ }
}

interface Categoria {
  id: string;
  categoria: { id: string; nome: string; slug: string };
}

export function FormularioSolicitacao({ profissionalId, profissionalNome, categorias }: { profissionalId: string; profissionalNome: string; categorias: Categoria[] }) {
  const [sessao, setSessao] = useState<SessaoLocal | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  useEffect(() => {
    let ativo = true;
    void restaurarSessao()
      .then(sessao => { if (ativo) setSessao(sessao); })
      .catch(() => { if (ativo) setSessao(null); })
      .finally(() => { if (ativo) setCarregandoSessao(false); });
    return () => { ativo = false; };
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
        <p className="font-medium text-terra-600">Esta conta é de profissional. Para pedir um orçamento, entre com uma conta de cliente.</p>
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
        <button type="button" onClick={() => setModo("entrar")} className={modo === "entrar" ? "pb-3 text-sm font-medium border-b-2 border-relva-500 text-pinho-900" : "pb-3 text-sm font-medium text-pinho-700"}>Já tenho conta</button>
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
  const enviandoRef = useRef(false);
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
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setErro("");
    setCarregando(true);
    try {
      const corpo = JSON.stringify({
        profissionalId, categoriaId, cep: cep.replace(/\\D/g, ""),
        endereco, tamanhoM2: Number(tamanhoM2), descricao: descricao || undefined,
      });
      const chave = await chaveDaTentativa(corpo);
      const resposta = await fetchAutenticado("/api/solicitacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": chave,
          Authorization: `Bearer ${accessToken}`,
        },
        body: corpo,
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro ?? "Não foi possível enviar a solicitação");
      }
      finalizarTentativa(chave);
      setLinkWhatsapp(dados.linkWhatsapp);
    } catch (err) {
      // Um timeout pode ocorrer DEPOIS do commit no banco. Retemos a chave
      // para que a próxima tentativa recupere o mesmo pedido, sem novo Push.
      setErro(err instanceof Error ? err.message : "Algo deu errado");
    } finally {
      enviandoRef.current = false;
      setCarregando(false);
    }
  }

  if (linkWhatsapp) {
    return (
      <div className="rounded-2xl border border-relva-500/40 bg-relva-500/10 p-6 text-center">
        <p className="font-display text-lg font-semibold text-pinho-900">Solicitação enviada!</p>
        <p className="mt-2 text-pinho-700">Agora é só falar com {profissionalNome} pelo WhatsApp para combinar os detalhes.</p>
        <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-xl bg-relva-500 px-6 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600">Abrir WhatsApp</a>
      </div>
    );
  }

  return (
    <form onSubmit={aoSubmeter} className="flex flex-col gap-3 rounded-2xl border border-areia-300 bg-white/70 p-6">
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-pinho-700">Serviço</label>
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
        <label className="text-xs font-medium uppercase tracking-wide text-pinho-700">Endereço completo</label>
        <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} required placeholder="Rua, número, bairro" className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-pinho-700">Tamanho aproximado (m2)</label>
        <input type="number" value={tamanhoM2} onChange={(e) => setTamanhoM2(e.target.value)} required min={1} placeholder="Ex: 100" className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-2 font-data text-pinho-900 outline-none focus:border-relva-500" />
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-pinho-700">Detalhes (opcional)</label>
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Conte mais sobre o serviço de que precisa" className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-2 text-pinho-900 outline-none focus:border-relva-500" />
      </div>

      {erro && <p className="text-sm text-terra-600">{erro}</p>}

      <button type="submit" disabled={carregando} className="mt-2 rounded-xl bg-relva-500 px-4 py-3 font-semibold text-sauge-50 transition hover:bg-relva-600 disabled:opacity-60">
        {carregando ? "Enviando..." : "Enviar e gerar link do WhatsApp"}
      </button>
    </form>
  );
}
