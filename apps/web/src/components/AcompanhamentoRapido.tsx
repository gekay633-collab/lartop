"use client";

import { useCallback, useEffect, useState } from "react";

interface Pedido {
  id: string;
  referencia?: string;
  status: string;
  criadoEm: string;
  jaAvaliada?: boolean;
  primeiroNomeParaAvaliacao?: string | null;
  avaliacao?: { nota: number; comentario: string | null; nomePublico?: string | null };
  categoria: { nome: string };
  profissional: { nomeExibicao: string };
  linkWhatsapp?: string;
}

const STATUS: Record<string, string> = {
  PENDENTE: "Aguardando resposta do prestador",
  RESPONDIDA: "Profissional respondeu ao pedido",
  ACEITA: "Solicitação aceita pelo prestador",
  RECUSADA: "Prestador não poderá atender",
  CONCLUIDA: "Prestador marcou o serviço como concluído",
  CANCELADA: "Solicitação cancelada",
};

export function AcompanhamentoRapido({ id }: { id: string }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [confirmou, setConfirmou] = useState<"sim" | "nao" | null>(null);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [publicarNome, setPublicarNome] = useState(false);
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [mensagemNome, setMensagemNome] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      // Fragmento da URL não é transmitido ao servidor em requisições HTTP.
      const token = window.location.hash.slice(1);
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        throw new Error("Este link está incompleto. Abra o link original de acompanhamento.");
      }
      const resposta = await fetch(`/api/solicitacoes/rapidas/${encodeURIComponent(id)}/acompanhar`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const resultado: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        const mensagem = resultado && typeof resultado === "object" && "erro" in resultado &&
          typeof resultado.erro === "string" ? resultado.erro : "Não foi possível consultar o pedido.";
        throw new Error(mensagem);
      }
      if (!resultado || typeof resultado !== "object" || !("id" in resultado) ||
          typeof resultado.id !== "string" || !("status" in resultado) ||
          typeof resultado.status !== "string" || !("profissional" in resultado) ||
          !resultado.profissional || typeof resultado.profissional !== "object" ||
          !("nomeExibicao" in resultado.profissional)) {
        throw new Error("O servidor retornou dados inesperados.");
      }
      const pedidoRecebido = resultado as Pedido;
      setPedido(pedidoRecebido);
      setPublicarNome(Boolean(pedidoRecebido.avaliacao?.nomePublico));
      setMensagemNome("");
    } catch (falha) {
      setPedido(null);
      setErro(falha instanceof Error ? falha.message : "Erro ao acompanhar solicitação.");
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
    } catch {
      setErro("Copie o endereço desta página no navegador para guardar seu link.");
    }
  }

  async function enviarAvaliacao(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviandoAvaliacao || !pedido || pedido.status !== "CONCLUIDA" ||
        pedido.jaAvaliada || confirmou !== "sim" || nota < 1 || nota > 5) return;
    setEnviandoAvaliacao(true);
    setErro("");
    try {
      const token = window.location.hash.slice(1);
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        throw new Error("Link incompleto. Abra seu link privado original.");
      }
      const resposta = await fetch(`/api/solicitacoes/rapidas/${encodeURIComponent(id)}/avaliar`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, confirmacao: true, nota,
          comentario: comentario.trim(), publicarPrimeiroNome: publicarNome }),
      });
      const resultado: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        const mensagem = resultado && typeof resultado === "object" && "erro" in resultado &&
          typeof resultado.erro === "string" ? resultado.erro : "Não foi possível enviar a avaliação.";
        if (resposta.status === 409) void carregar();
        throw new Error(mensagem);
      }
      setPedido({ ...pedido, jaAvaliada: true, avaliacao: {
        nota, comentario: comentario.trim() || null,
        nomePublico: publicarNome ? pedido.primeiroNomeParaAvaliacao ?? null : null,
      } });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível enviar a avaliação.");
    } finally {
      setEnviandoAvaliacao(false);
    }
  }

  async function salvarPreferenciaNome() {
    if (!pedido?.jaAvaliada || salvandoNome) return;
    setSalvandoNome(true);
    setMensagemNome("");
    setErro("");
    try {
      const token = window.location.hash.slice(1);
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        throw new Error("Abra o link privado original para atualizar a avaliação.");
      }
      const resposta = await fetch(`/api/solicitacoes/rapidas/${encodeURIComponent(id)}/avaliacao/nome-publico`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, publicarPrimeiroNome: publicarNome }),
      });
      const resultado: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        const mensagem = resultado && typeof resultado === "object" && "erro" in resultado &&
          typeof resultado.erro === "string" ? resultado.erro : "Falha ao atualizar a preferência.";
        throw new Error(mensagem);
      }
      if (!resultado || typeof resultado !== "object" ||
          !("nomePublico" in resultado) ||
          !(resultado.nomePublico === null || typeof resultado.nomePublico === "string")) {
        throw new Error("Resposta inesperada ao salvar a preferência.");
      }
      setPedido({ ...pedido, avaliacao: pedido.avaliacao ? {
        ...pedido.avaliacao, nomePublico: resultado.nomePublico as string | null,
      } : undefined });
      setMensagemNome(resultado.nomePublico
        ? "Seu primeiro nome está autorizado a aparecer publicamente."
        : "Seu nome ficará oculto nas avaliações públicas.");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar.");
    } finally {
      setSalvandoNome(false);
    }
  }

  function opcaoNomePublico() {
    if (!pedido?.primeiroNomeParaAvaliacao) return null;
    return (
      <label className="flex items-start gap-2 text-sm text-pinho-900">
        <input type="checkbox" checked={publicarNome}
          onChange={(e) => { setPublicarNome(e.target.checked); setMensagemNome(""); }}
          className="mt-1" />
        <span>Autorizo mostrar meu primeiro nome <strong>({pedido.primeiroNomeParaAvaliacao})</strong> publicamente nesta avaliação. O sobrenome e o WhatsApp não serão exibidos.</span>
      </label>
    );
  }

  return (
    <section className="rounded-2xl border border-areia-300 bg-white/75 p-5 sm:p-6">
      <h1 className="font-display text-2xl font-semibold text-pinho-900">Acompanhar solicitação</h1>
      <p className="mt-2 text-sm text-pinho-700">
        Este é um link privado. Não compartilhe com outras pessoas.
      </p>

      {carregando ? <p role="status" className="mt-5 text-pinho-700">Consultando pedido...</p> : null}
      {erro ? <p role="alert" className="mt-5 text-terra-600">{erro}</p> : null}
      {pedido ? (
        <div className="mt-5 flex flex-col gap-3">
          <div className="rounded-xl bg-sauge-100 p-4">
            <p className="text-sm text-pinho-700">Status atual</p>
            <p className="mt-1 font-semibold text-pinho-900">{STATUS[pedido.status] ?? "Em acompanhamento"}</p>
          </div>
          {pedido.referencia && <p className="text-pinho-900"><strong>Referência LARTOP:</strong> {pedido.referencia}</p>}
          <p className="text-pinho-900"><strong>Serviço:</strong> {pedido.categoria.nome}</p>
          <p className="text-pinho-900"><strong>Profissional:</strong> {pedido.profissional.nomeExibicao}</p>
          <p className="text-sm text-pinho-700">Solicitação registrada em {new Date(pedido.criadoEm).toLocaleDateString("pt-BR")}</p>
          <p className="text-xs text-pinho-700">
            O status reflete as atualizações registradas na LARTOP. Ele não confirma que uma mensagem foi enviada pelo WhatsApp.
          </p>
          {pedido.status === "CONCLUIDA" && (
            <div className="rounded-xl border border-areia-300 bg-white p-4" aria-live="polite">
              {pedido.jaAvaliada ? (
                <div role="status">
                  <h2 className="font-display text-lg font-semibold text-pinho-900">Avaliação registrada</h2>
                  <p className="mt-1 text-sm text-pinho-700">
                    Obrigado pelo feedback. {pedido.avaliacao ? `Sua nota: ${pedido.avaliacao.nota}/5.` : "Sua avaliação foi recebida."}
                  </p>
                  <div className="mt-4 flex flex-col gap-3 border-t border-areia-300 pt-3">
                    <p className="text-sm text-pinho-700">
                      Nome exibido publicamente: <strong>{pedido.avaliacao?.nomePublico ?? "Cliente LARTOP"}</strong>
                    </p>
                    {opcaoNomePublico()}
                    {pedido.primeiroNomeParaAvaliacao && (
                      <button type="button" onClick={() => void salvarPreferenciaNome()}
                        disabled={salvandoNome}
                        className="min-h-11 rounded-lg border border-relva-500 px-4 py-2 text-sm font-semibold text-relva-600 disabled:opacity-60">
                        {salvandoNome ? "Salvando..." : "Salvar preferência de nome"}
                      </button>
                    )}
                    {mensagemNome && <p role="status" className="text-sm text-pinho-700">{mensagemNome}</p>}
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => void enviarAvaliacao(e)} className="flex flex-col gap-3">
                  <h2 className="font-display text-lg font-semibold text-pinho-900">O serviço foi realizado?</h2>
                  <p className="text-sm text-pinho-700">O prestador marcou o pedido como concluído. Confirme antes de avaliar.</p>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="sr-only">Confirmação da realização do serviço</legend>
                    <label className="flex items-center gap-2 text-pinho-900">
                      <input type="radio" name="servico-realizado" checked={confirmou === "sim"}
                        onChange={() => setConfirmou("sim")} /> Sim, o serviço foi realizado
                    </label>
                    <label className="flex items-center gap-2 text-pinho-900">
                      <input type="radio" name="servico-realizado" checked={confirmou === "nao"}
                        onChange={() => setConfirmou("nao")} /> Não, o serviço não foi realizado
                    </label>
                  </fieldset>
                  {confirmou === "nao" && (
                    <p className="rounded-lg bg-areia-100 p-3 text-sm text-pinho-900">
                      Não enviaremos uma avaliação. O status foi informado pelo prestador;
                      fale com ele pelo WhatsApp para esclarecer a conclusão.
                    </p>
                  )}
                  {confirmou === "sim" && (
                    <>
                      <fieldset>
                        <legend className="text-sm font-semibold text-pinho-900">Sua nota (obrigatória)</legend>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[1, 2, 3, 4, 5].map((numero) => (
                            <button type="button" key={numero} onClick={() => setNota(numero)}
                              aria-label={`${numero} ${numero === 1 ? "estrela" : "estrelas"}`}
                              aria-pressed={nota === numero}
                              className={`min-h-11 min-w-11 rounded-lg border px-2 text-2xl focus-visible:outline-2 focus-visible:outline-relva-500 ${numero <= nota ? "border-terra-500 text-terra-500" : "border-areia-300 text-areia-300"}`}>
                              <span aria-hidden="true">★</span>
                            </button>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-pinho-700">
                          {nota ? `${nota} de 5 estrelas` : "Selecione a quantidade de estrelas"}
                        </p>
                      </fieldset>
                      <div>
                        <label htmlFor="comentario-visitante" className="block text-sm font-medium text-pinho-900">
                          Comentário (opcional)
                        </label>
                        <textarea id="comentario-visitante" value={comentario}
                          onChange={(e) => setComentario(e.target.value)} maxLength={500} rows={3}
                          placeholder="Como foi o atendimento?"
                          className="mt-1 w-full rounded-lg border border-areia-300 bg-white px-3 py-2 text-sm text-pinho-900" />
                        <p className="text-right text-xs text-pinho-700">{comentario.length}/500</p>
                      </div>
                      {opcaoNomePublico()}
                      <button type="submit" disabled={!nota || enviandoAvaliacao}
                        className="min-h-11 rounded-xl bg-relva-500 px-4 py-3 font-semibold text-sauge-50 disabled:opacity-60">
                        {enviandoAvaliacao ? "Registrando avaliação..." : "Enviar avaliação"}
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>
          )}
          {pedido.linkWhatsapp?.startsWith("https://wa.me/") ? (
            <a href={pedido.linkWhatsapp} target="_blank" rel="noopener noreferrer"
              className="rounded-xl bg-relva-500 px-4 py-3 text-center font-semibold text-sauge-50">
              Abrir WhatsApp do profissional
            </a>
          ) : null}
          <button type="button" onClick={() => void copiar()}
            className="rounded-lg border border-areia-300 px-4 py-2 text-sm font-medium text-pinho-900">
            {copiado ? "Link copiado!" : "Copiar meu link privado"}
          </button>
        </div>
      ) : null}
      <button type="button" onClick={() => void carregar()} disabled={carregando}
        className="mt-4 rounded-lg border border-relva-500 px-4 py-2 text-sm font-medium text-relva-600 disabled:opacity-60">
        Atualizar status
      </button>
    </section>
  );
}
