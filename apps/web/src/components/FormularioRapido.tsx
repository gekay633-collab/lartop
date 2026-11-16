"use client";

import { useRef, useState } from "react";

interface Categoria {
  id: string;
  categoria: { id: string; nome: string; slug: string };
}

const CHAVE_TENTATIVA = "lartop:rapida:tentativa:v1";

async function tentativaPara(corpo: string): Promise<{ tentativaId: string; token: string }> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(corpo));
  const resumo = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
  try {
    const valor = JSON.parse(sessionStorage.getItem(CHAVE_TENTATIVA) || "null") as
      { resumo?: string; tentativaId?: string; token?: string } | null;
    if (valor?.resumo === resumo &&
        valor.tentativaId && /^[0-9a-f-]{36}$/i.test(valor.tentativaId) &&
        valor.token && /^[A-Za-z0-9_-]{43}$/.test(valor.token)) {
      return { tentativaId: valor.tentativaId, token: valor.token };
    }
  } catch { /* Armazenamento opcional, a validação do servidor permanece. */ }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const nova = { tentativaId: crypto.randomUUID(), token };
  try {
    // Não gravar nome, telefone ou descrição no sessionStorage.
    sessionStorage.setItem(CHAVE_TENTATIVA, JSON.stringify({ resumo, ...nova }));
  } catch { /* opcional */ }
  return nova;
}

export function FormularioRapido({
  profissionalId, profissionalNome, categorias,
}: {
  profissionalId: string;
  profissionalNome: string;
  categorias: Categoria[];
}) {
  const enviandoRef = useRef(false);
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.categoria.id ?? "");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [descricao, setDescricao] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState<{ link: string; whatsappUrl: string } | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErro("");
    try {
      const dados = {
        profissionalId, categoriaId, nome: nome.trim(), whatsapp: whatsapp.trim(),
        descricao: descricao.trim(), consentimento,
      };
      const chave = await tentativaPara(JSON.stringify(dados));
      const resposta = await fetch("/api/solicitacoes/rapidas", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, ...chave, site: "" }),
        cache: "no-store",
      });
      const resultado: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        const mensagem = resultado && typeof resultado === "object" && "erro" in resultado &&
          typeof resultado.erro === "string" ? resultado.erro : "Não foi possível enviar o pedido.";
        throw new Error(mensagem);
      }
      if (!resultado || typeof resultado !== "object" || !("id" in resultado) ||
          typeof resultado.id !== "string" || !("linkWhatsapp" in resultado) ||
          typeof resultado.linkWhatsapp !== "string" ||
          !resultado.linkWhatsapp.startsWith("https://wa.me/")) {
        throw new Error("O servidor não confirmou o pedido corretamente.");
      }

      const link = `${window.location.origin}/acompanhar/${encodeURIComponent(resultado.id)}#${chave.token}`;
      setSucesso({ link, whatsappUrl: resultado.linkWhatsapp });
      // Guardar a última tentativa enquanto a aba estiver aberta evita perder o
      // acesso após timeout ou refresh ANTES de receber a confirmação.
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha no envio.");
    } finally {
      setEnviando(false);
      enviandoRef.current = false;
    }
  }

  async function copiar() {
    if (!sucesso) return;
    try {
      await navigator.clipboard.writeText(sucesso.link);
      setCopiado(true);
    } catch {
      setErro("Selecione e copie o link exibido abaixo para guardar o acompanhamento.");
    }
  }

  if (sucesso) {
    return (
      <section role="status" className="rounded-2xl border border-relva-500/40 bg-relva-500/10 p-5">
        <h2 className="font-display text-xl font-semibold text-pinho-900">Solicitação registrada!</h2>
        <p className="mt-2 text-sm text-pinho-700">
          O prestador recebeu o pedido na LARTOP. Para iniciar a conversa, abra o WhatsApp e toque em Enviar.
        </p>
        <a href={sucesso.whatsappUrl} target="_blank" rel="noopener noreferrer"
          className="mt-4 block rounded-xl bg-relva-500 px-4 py-3 text-center font-semibold text-sauge-50">
          Conversar com {profissionalNome} no WhatsApp
        </a>
        <p className="mt-5 text-sm font-semibold text-pinho-900">Guarde seu link de acompanhamento</p>
        <p className="mt-1 text-sm text-pinho-700">
          Com ele você poderá consultar o pedido sem criar conta. Não compartilhe: quem tiver o link poderá acompanhar sua solicitação.
        </p>
        <input readOnly aria-label="Link privado de acompanhamento" value={sucesso.link}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full rounded-lg border border-areia-300 bg-white px-3 py-3 text-xs text-pinho-900" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void copiar()}
            className="rounded-lg border border-relva-500 px-4 py-2 font-medium text-relva-600">
            {copiado ? "Link copiado!" : "Copiar link"}
          </button>
          <a href={sucesso.link} className="rounded-lg border border-areia-300 px-4 py-2 font-medium text-pinho-900">
            Acompanhar pedido
          </a>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4 rounded-2xl border border-areia-300 bg-white/70 p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-pinho-900">Pedido rápido, sem cadastro</h2>
        <p className="mt-1 text-sm text-pinho-700">Não pedimos e-mail ou senha.</p>
      </div>
      <div>
        <label htmlFor="rapido-nome" className="block text-sm font-medium text-pinho-900">Seu nome</label>
        <input id="rapido-nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)}
          minLength={2} maxLength={80} required placeholder="Como podemos chamar você?"
          className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-3 text-pinho-900" />
      </div>
      <div>
        <label htmlFor="rapido-whatsapp" className="block text-sm font-medium text-pinho-900">WhatsApp com DDD</label>
        <input id="rapido-whatsapp" type="tel" inputMode="tel" autoComplete="tel"
          value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required maxLength={20}
          placeholder="(21) 99999-9999" className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-3 text-pinho-900" />
        <p className="mt-1 text-xs text-pinho-700">O número será compartilhado com o prestador para contato, sem verificação por SMS.</p>
      </div>
      <div>
        <label htmlFor="rapido-servico" className="block text-sm font-medium text-pinho-900">Serviço</label>
        <select id="rapido-servico" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}
          required className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-3 text-pinho-900">
          {categorias.map(({ categoria }) => (
            <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="rapido-descricao" className="block text-sm font-medium text-pinho-900">O que você precisa?</label>
        <textarea id="rapido-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)}
          minLength={8} maxLength={1000} required rows={3}
          placeholder="Ex.: Preciso de alguém para limpar minha piscina esta semana."
          className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-3 text-pinho-900" />
      </div>
      <label className="flex items-start gap-2 text-sm text-pinho-700">
        <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)}
          required className="mt-1" />
        <span>Autorizo o uso do meu nome, WhatsApp e pedido para atendimento pelo prestador, conforme a{" "}
          <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-relva-600 underline">
            Política de Privacidade</a>.</span>
      </label>
      {erro && <p role="alert" className="text-sm text-terra-600">{erro}</p>}
      <button type="submit" disabled={enviando || !categoriaId || !consentimento}
        className="rounded-xl bg-relva-500 px-4 py-3 font-semibold text-sauge-50 disabled:opacity-60">
        {enviando ? "Registrando pedido..." : "Solicitar serviço sem cadastro"}
      </button>
    </form>
  );
}
