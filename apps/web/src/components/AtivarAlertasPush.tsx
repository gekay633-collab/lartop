"use client";

import { fetchAutenticado } from "@/lib/auth-client";

import { useEffect, useState } from "react";
import { desativarPushNoDispositivo } from "@/lib/push-client";

type EstadoPush = "verificando" | "indisponivel" | "desativado" | "ativo";

function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const base = base64.replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(base.padEnd(Math.ceil(base.length / 4) * 4, "="));
  return Uint8Array.from(bruto, c => c.charCodeAt(0));
}

function eIphone(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function instaladoComoApp(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function mensagemErro(resposta: Response, dados: unknown): string {
  if (dados && typeof dados === "object" && "erro" in dados && typeof dados.erro === "string") {
    return dados.erro;
  }
  return `Erro ao configurar as notificações (HTTP ${resposta.status}).`;
}

// Uma inscrição é compartilhada por abas do mesmo navegador. Impede que
// verificações simultâneas consumam/substituam o mesmo endpoint várias vezes.
let sincronizacaoPendente: Promise<void> | null = null;

async function coordenarInscricao(acao: () => Promise<void>): Promise<void> {
  if (sincronizacaoPendente) return sincronizacaoPendente;
  const operacao = (async () => {
    if (navigator.locks?.request) {
      await navigator.locks.request("lartop:push-reinscricao", acao);
    } else {
      await acao();
    }
  })();
  sincronizacaoPendente = operacao;
  try {
    await operacao;
  } finally {
    if (sincronizacaoPendente === operacao) sincronizacaoPendente = null;
  }
}

export function AtivarAlertasPush({ accessToken }: { accessToken: string }) {
  const [estado, setEstado] = useState<EstadoPush>("verificando");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [instrucaoIphone, setInstrucaoIphone] = useState(false);
  const [testeId, setTesteId] = useState<string | null>(null);
  const [resultadoTeste, setResultadoTeste] = useState<{ provedor: string; worker: string } | null>(null);
  const [erroTeste, setErroTeste] = useState("");
  const [testando, setTestando] = useState(false);

  /** Confirma a inscrição no servidor, e não apenas a permissão do Android. */
  async function registradaNoServidor(assinatura: PushSubscription): Promise<boolean> {
    const resposta = await fetchAutenticado("/api/push/assinaturas/verificar", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: assinatura.endpoint }),
    });
    if (!resposta.ok) {
      throw new Error("Não foi possível confirmar os alertas com o servidor.");
    }
    const dados: unknown = await resposta.json().catch(() => null);
    if (!dados || typeof dados !== "object" || !("registrada" in dados) ||
        typeof dados.registrada !== "boolean") {
      throw new Error("O servidor retornou um estado de notificações inválido.");
    }
    return dados.registrada;
  }

  async function registrarInscricao(registro: ServiceWorkerRegistration, substituir: boolean) {
    let assinatura = await registro.pushManager.getSubscription();
    if (assinatura && !substituir) {
      if (await registradaNoServidor(assinatura)) return;
      // HTTP 410 limpou a inscrição apenas no servidor; não reutilizar
      // esse endpoint obsoleto que ainda pode existir no navegador.
      substituir = true;
    }

    if (assinatura && substituir) {
      // Remover o endpoint antigo também do servidor: reparos manuais
      // repetidos não podem acumular inscrições e atingir o limite de 5.
      const exclusao = await fetchAutenticado("/api/push/assinaturas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: assinatura.endpoint }),
      });
      if (!exclusao.ok) {
        throw new Error("Não foi possível liberar a inscrição anterior. Tente novamente.");
      }
      // O próprio navegador pode continuar retornando o endpoint expirado.
      // Um unsubscribe explícito força a obtenção de uma inscrição nova.
      await assinatura.unsubscribe();
      assinatura = null;
    }

    const chaveResposta = await fetch("/api/push/chave-publica", { cache: "no-store" });
    const chaveDados: unknown = await chaveResposta.json().catch(() => null);
    if (!chaveResposta.ok) throw new Error(mensagemErro(chaveResposta, chaveDados));
    if (!chaveDados || typeof chaveDados !== "object" ||
        !("chave" in chaveDados) || typeof chaveDados.chave !== "string") {
      throw new Error("Chave de notificações indisponível.");
    }
    const nova = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chaveParaBytes(chaveDados.chave),
    });
    const dados = nova.toJSON();
    if (!dados.endpoint || !dados.keys?.p256dh || !dados.keys?.auth) {
      throw new Error("Não foi possível registrar este aparelho.");
    }
    const resposta = await fetchAutenticado("/api/push/assinaturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: dados.endpoint, keys: dados.keys }),
    });
    const resultado: unknown = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(mensagemErro(resposta, resultado));
  }

  useEffect(() => {
    let ativo = true;
    async function verificar() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) ||
          !("Notification" in window)) {
        if (ativo) { setEstado("indisponivel"); setInstrucaoIphone(eIphone()); }
        return;
      }
      if (eIphone() && !instaladoComoApp()) {
        if (ativo) { setEstado("indisponivel"); setInstrucaoIphone(true); }
        return;
      }
      if (Notification.permission !== "granted") {
        if (ativo) setEstado("desativado");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        if (!reg) {
          if (ativo) setEstado("desativado");
          return;
        }
        // Uma inscrição perdida/expirada após HTTP 410 é recriada na abertura
        // do painel, sem pedir novamente a permissão já concedida.
        await coordenarInscricao(() => registrarInscricao(reg, false));
        if (ativo) { setEstado("ativo"); setErro(""); }
      } catch {
        if (ativo) {
          setEstado("desativado");
          setErro("Seu celular precisa reconectar os alertas. Toque em Ativar alertas para tentar novamente.");
        }
      }
    }
    void verificar();
    return () => { ativo = false; };
  }, [accessToken]);

  async function ativar(forcarRenovacao = false) {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      // Este pedido continua diretamente ligado ao clique do usuário.
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        throw new Error("Permita as notificações nas configurações do navegador ou do celular.");
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await coordenarInscricao(() => registrarInscricao(reg, forcarRenovacao));
      setEstado("ativo");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ativar alertas neste aparelho.");
    } finally {
      setOcupado(false);
    }
  }

  async function iniciarTeste() {
    if (testando) return;
    setTestando(true);
    setErroTeste("");
    setResultadoTeste(null);
    setTesteId(null);
    try {
      const registro = await navigator.serviceWorker.getRegistration("/");
      // Verifica a versão do service worker antes de testar a confirmação;
      // o PWA pode ter sido instalado antes dessa funcionalidade existir.
      await registro?.update();
      const assinatura = await registro?.pushManager.getSubscription();
      if (!assinatura || Notification.permission !== "granted") {
        throw new Error("Ative os alertas deste aparelho antes de testar.");
      }

      const resposta = await fetchAutenticado("/api/push/teste", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: assinatura.endpoint }),
      });
      const dados: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(mensagemErro(resposta, dados));
      if (!dados || typeof dados !== "object" || !("id" in dados) ||
          typeof dados.id !== "string") {
        throw new Error("O servidor não confirmou o agendamento do teste.");
      }
      setTesteId(dados.id);
    } catch (e) {
      setErroTeste(e instanceof Error ? e.message : "Não foi possível iniciar o teste.");
    } finally {
      setTestando(false);
    }
  }

  useEffect(() => {
    if (!testeId) return;
    let ativo = true;
    async function consultar() {
      if (document.visibilityState === "hidden") return;
      try {
        const resposta = await fetchAutenticado(`/api/push/teste/${testeId}`, {
          cache: "no-store",
        });
        const dados: unknown = await resposta.json().catch(() => null);
        if (!resposta.ok || !dados || typeof dados !== "object" ||
            !("provedor" in dados) || typeof dados.provedor !== "string" ||
            !("worker" in dados) || typeof dados.worker !== "string") {
          throw new Error("Não foi possível consultar o teste.");
        }
        if (ativo) {
          setResultadoTeste({ provedor: dados.provedor, worker: dados.worker });
          setErroTeste("");
        }
      } catch {
        if (ativo) setErroTeste("Não foi possível consultar o resultado. Abra o painel novamente.");
      }
    }
    void consultar();
    const intervalo = window.setInterval(() => void consultar(), 3000);
    const aoRetomar = () => { if (document.visibilityState === "visible") void consultar(); };
    window.addEventListener("visibilitychange", aoRetomar);
    window.addEventListener("focus", aoRetomar);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.removeEventListener("visibilitychange", aoRetomar);
      window.removeEventListener("focus", aoRetomar);
    };
  }, [testeId]);

  async function desativar() {
    if (ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      await desativarPushNoDispositivo(accessToken);
      setEstado("desativado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível desativar os alertas.");
      // O backend pode falhar depois de o navegador já ter feito unsubscribe.
      const reg = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
      const inscricao = await reg?.pushManager.getSubscription().catch(() => null);
      if (!inscricao) setEstado("desativado");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-areia-300 bg-white/75 p-3 text-sm text-pinho-900">
      {estado === "verificando" && <p>Verificando alertas do celular...</p>}
      {estado === "indisponivel" && (
        <p>{instrucaoIphone
          ? "No iPhone, abra o Lartop no Safari, toque em Compartilhar > Adicionar à Tela de Início e abra pelo ícone. Depois ative os alertas aqui."
          : "Este navegador não oferece notificações push. Use um navegador atualizado no celular."}</p>
      )}
      {estado === "desativado" && (
        <button type="button" disabled={ocupado} onClick={() => void ativar(false)}
          className="rounded-lg bg-relva-500 px-4 py-2 font-medium text-white disabled:opacity-50">
          {ocupado ? "Ativando..." : "🔔 Ativar alertas no celular"}
        </button>
      )}
      {estado === "ativo" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-relva-600">✓ Alertas ativados neste aparelho</span>
          <button type="button" disabled={ocupado} onClick={() => void ativar(true)}
            className="rounded-lg border border-relva-500 px-3 py-2 text-relva-600 disabled:opacity-50">
            {ocupado ? "Reparando..." : "Reparar alertas"}
          </button>
          <button type="button" disabled={ocupado} onClick={() => void desativar()}
            className="rounded-lg border border-areia-300 px-3 py-2 text-pinho-700 disabled:opacity-50">
            {ocupado ? "Desativando..." : "Desativar"}
          </button>
        </div>
      )}
      {estado === "ativo" && (
        <div className="mt-4 border-t border-areia-300 pt-3">
          <p className="font-semibold">Teste de notificação com a tela bloqueada</p>
          <p className="mt-1 text-xs text-pinho-700">
            Toque no botão e bloqueie o celular. O servidor enviará um aviso em 12 segundos.
            Depois, desbloqueie e consulte o resultado aqui. Nenhum pedido será criado.
          </p>
          <button type="button" onClick={() => void iniciarTeste()} disabled={testando}
            className="mt-2 rounded-lg border border-pinho-900 px-4 py-2 font-medium text-pinho-900 disabled:opacity-50">
            {testando ? "Preparando teste..." : "Enviar teste em 12 segundos"}
          </button>
          {testeId && (
            <div role="status" className="mt-2 rounded-lg bg-sauge-100 p-3 text-xs text-pinho-900">
              {resultadoTeste?.worker === "showNotification_ok"
                ? "O navegador recebeu o Push e executou showNotification. Confirme se o Android exibiu o aviso na tela bloqueada."
                : resultadoTeste?.worker === "showNotification_falhou"
                  ? "O navegador recebeu o Push, mas não conseguiu apresentar a notificação. Verifique as permissões do aplicativo no Android."
                  : resultadoTeste?.provedor === "expirado"
                    ? "O provedor informou que a inscrição expirou. Use Reparar alertas e faça um novo teste."
                    : resultadoTeste?.provedor === "erro" || resultadoTeste?.provedor === "indisponivel"
                      ? "O provedor não conseguiu aceitar o teste. Confira os alertas e tente novamente."
                      : resultadoTeste?.provedor === "aceito"
                        ? "O provedor aceitou o aviso; ainda não há confirmação do service worker. Caso não tenha aparecido, verifique as restrições de segundo plano."
                        : "Teste agendado. Bloqueie a tela e aguarde o aviso; volte aqui para consultar o resultado."}
            </div>
          )}
          {erroTeste && <p role="alert" className="mt-2 text-xs text-terra-600">{erroTeste}</p>}
        </div>
      )}
      {erro && <p role="alert" className="mt-2 text-terra-600">{erro}</p>}
      <p className="mt-2 text-xs text-pinho-700">
        Com a permissão do aparelho, os avisos podem aparecer mesmo com o Lartop fechado.
        O som depende das configurações do celular.
      </p>
    </div>
  );
}
