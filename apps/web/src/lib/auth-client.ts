"use client";

const CHAVE_TOKEN_LEGADO = "lartop_access_token";
let tokenEmMemoria: string | null = null;
let inicializacao: Promise<void> | null = null;
const CHAVE_TIPO = "lartop_tipo_usuario";
const CHAVE_NOME = "lartop_nome_usuario";
const EVENTO_SESSAO = "lartop:sessao-alterada";
const LIMIAR_RENOVACAO_SEGUNDOS = 60;
const NOME_BLOQUEIO_RENOVACAO = "lartop:renovacao-sessao";

function avisarMudancaSessao() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_SESSAO));
}

/** Atualiza cabeçalho e painéis em outra aba sem propagar tokens por mensagens. */
export function observarSessao(callback: () => void): () => void {
  const aoArmazenar = (evento: StorageEvent) => {
    if (!evento.key || [CHAVE_TOKEN_LEGADO, CHAVE_TIPO, CHAVE_NOME].includes(evento.key)) callback();
  };
  window.addEventListener("storage", aoArmazenar);
  window.addEventListener(EVENTO_SESSAO, callback);
  return () => {
    window.removeEventListener("storage", aoArmazenar);
    window.removeEventListener(EVENTO_SESSAO, callback);
  };
}

// A API pode retornar texto/HTML quando o proxy ou backend falha.
// Não converter cegamente esse tipo de resposta para JSON.
export async function lerRespostaAutenticacao<T>(
  resposta: Response,
  mensagemPadrao: string
): Promise<T> {
  const tipoConteudo = resposta.headers.get("content-type") ?? "";
  if (!tipoConteudo.toLowerCase().includes("application/json")) {
    throw new Error(`Servidor indisponível (HTTP ${resposta.status}). Verifique o serviço da API.`);
  }

  let dados: unknown;
  try {
    dados = await resposta.json();
  } catch {
    throw new Error(`Resposta inválida do servidor (HTTP ${resposta.status}).`);
  }

  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    throw new Error("Resposta inesperada do servidor. Tente novamente.");
  }

  if (!resposta.ok) {
    const mensagem = "erro" in dados && typeof dados.erro === "string"
      ? dados.erro
      : mensagemPadrao;
    throw new Error(`${mensagem} (HTTP ${resposta.status}).`);
  }

  return dados as T;
}

export interface SessaoLocal {
  accessToken: string;
  tipo: "CLIENTE" | "PROFISSIONAL" | "ADMIN";
  nome: string;
}

export function obterSessao(): SessaoLocal | null {
  if (typeof window === "undefined") return null;
  const accessToken = tokenEmMemoria;
  const tipo = localStorage.getItem(CHAVE_TIPO) as SessaoLocal["tipo"] | null;
  const nome = localStorage.getItem(CHAVE_NOME);
  if (!accessToken || !tipo || !nome) return null;
  return { accessToken, tipo, nome };
}

export function salvarSessao(sessao: SessaoLocal) {
  // O access token nunca é persistido no armazenamento do navegador.
  localStorage.removeItem(CHAVE_TOKEN_LEGADO);
  tokenEmMemoria = sessao.accessToken;
  localStorage.setItem(CHAVE_TIPO, sessao.tipo);
  localStorage.setItem(CHAVE_NOME, sessao.nome);
  avisarMudancaSessao();
}

export function limparSessao() {
  tokenEmMemoria = null;
  localStorage.removeItem(CHAVE_TOKEN_LEGADO);
  localStorage.removeItem(CHAVE_TIPO);
  localStorage.removeItem(CHAVE_NOME);
  avisarMudancaSessao();
}

/**
 * Restores an existing HttpOnly refresh-cookie session after a page reload.
 * Runs once per page lifecycle, before protected UI is mounted.
 * Never imports the legacy localStorage JWT into memory.
 */
export function inicializarSessao(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (inicializacao) return inicializacao;
  inicializacao = (async () => {
    localStorage.removeItem(CHAVE_TOKEN_LEGADO);
    if (obterSessao()) return;
    await comBloqueioSessao(async () => {
      const resposta = await fetch("/api/auth/refresh", {
        method: "POST", credentials: "include", cache: "no-store",
      });
      if (resposta.status === 401) {
        limparSessao();
        return;
      }
      if (!resposta.ok) throw new Error("Não foi possível restaurar sua sessão.");
      const dados = await lerRespostaAutenticacao<{ accessToken: string }>(
        resposta, "Não foi possível restaurar sua sessão"
      );
      if (!dados.accessToken) throw new Error("Token de sessão ausente.");
      const usuario = await buscarUsuarioLogado(dados.accessToken);
      salvarSessao({ accessToken: dados.accessToken, nome: usuario.nome, tipo: usuario.tipo });
    });
  })();
  return inicializacao.catch(erro => {
    inicializacao = null;
    throw erro;
  });
}

/**
 * Encerra a sessão primeiro no servidor (cookie refresh + access JWT) e
 * somente depois apaga o estado local. Isso evita logout falso se o Redis
 * estiver temporariamente indisponível.
 */
export async function encerrarSessao(accessToken?: string): Promise<void> {
  // Logout aguarda qualquer refresh em outra aba antes de invalidar o cookie.
  await comBloqueioSessao(async () => {
    const tokenAtual = obterSessao()?.accessToken ?? accessToken;
    const resposta = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: tokenAtual ? { Authorization: `Bearer ${tokenAtual}` } : {},
    });
    if (!resposta.ok) {
      throw new Error("O servidor não confirmou o encerramento da sessão.");
    }
    limparSessao();
  });
}

async function buscarUsuarioLogado(accessToken: string): Promise<{ nome: string; tipo: SessaoLocal["tipo"] }> {
  const resposta = await fetch(`/api/usuarios/mim`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const dados = await lerRespostaAutenticacao<{ nome: string; tipo: SessaoLocal["tipo"] }>(
    resposta,
    "Não foi possível consultar sua conta"
  );
  if (!dados.nome || !dados.tipo) throw new Error("Dados da conta incompletos.");
  return { nome: dados.nome, tipo: dados.tipo };
}

export async function entrar(email: string, senha: string): Promise<SessaoLocal> {
  const resposta = await fetch(`/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, senha }),
  });

  const dados = await lerRespostaAutenticacao<{ accessToken: string }>(
    resposta,
    "Não foi possível entrar"
  );
  if (typeof dados.accessToken !== "string" || !dados.accessToken) {
    throw new Error("O servidor não retornou um token de acesso válido.");
  }

  const usuario = await buscarUsuarioLogado(dados.accessToken);
  const sessao: SessaoLocal = { accessToken: dados.accessToken, tipo: usuario.tipo, nome: usuario.nome };
  salvarSessao(sessao);
  return sessao;
}

export async function registrarComoCliente(input: { nome: string; email: string; senha: string; telefone?: string }): Promise<SessaoLocal> {
  const resposta = await fetch(`/api/auth/registrar/cliente`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  const dados = await lerRespostaAutenticacao<{
    accessToken: string;
    usuario: { tipo: SessaoLocal["tipo"]; nome: string };
  }>(resposta, "Não foi possível cadastrar");
  if (!dados.accessToken || !dados.usuario?.nome || !dados.usuario?.tipo) {
    throw new Error("Resposta incompleta do servidor ao cadastrar.");
  }

  const sessao: SessaoLocal = { accessToken: dados.accessToken, tipo: dados.usuario.tipo, nome: dados.usuario.nome };
  salvarSessao(sessao);
  return sessao;
}


/**
 * O JWT é decodificado apenas para antecipar a renovação; sua autenticidade
 * continua sendo verificada exclusivamente pela API.
 */
function tokenPrestesAExpirar(token: string): boolean {
  try {
    const parte = token.split(".")[1];
    if (!parte) return false;
    const base64 = parte.replace(/-/g, "+").replace(/_/g, "/");
    const payload: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return Boolean(payload && typeof payload === "object" && "exp" in payload &&
      typeof payload.exp === "number" &&
      payload.exp <= Date.now() / 1000 + LIMIAR_RENOVACAO_SEGUNDOS);
  } catch {
    return false;
  }
}

/** O Web Locks garante que só uma aba use o refresh cookie rotativo por vez. */
async function comBloqueioSessao<T>(operacao: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(NOME_BLOQUEIO_RENOVACAO, operacao);
  }
  // Sem Web Locks, o logout continua possível; a renovação é recusada abaixo.
  return operacao();
}

let renovacaoPendente: Promise<string> | null = null;

async function renovarTokenUmaVez(tokenAnterior: string): Promise<string> {
  if (renovacaoPendente) return renovacaoPendente;

  const promessa = (async () => {
    if (!navigator.locks?.request) {
      // Melhor pedir novo login em navegadores antigos do que revogar um cookie
      // válido por duas renovações concorrentes em abas diferentes.
      throw new Error("Este navegador não suporta renovação segura. Entre novamente.");
    }

    return comBloqueioSessao(async () => {
      const sessao = obterSessao();
      if (!sessao) throw new Error("Sua sessão terminou. Entre novamente.");
      if (sessao.accessToken !== tokenAnterior) return sessao.accessToken;

      let resposta: Response;
      try {
        resposta = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        throw new Error("Sem conexão para renovar a sessão. Tente novamente.");
      }

      if (!resposta.ok) {
        const novoToken = obterSessao()?.accessToken;
        if (novoToken && novoToken !== tokenAnterior) return novoToken;
        if (resposta.status === 401) {
          limparSessao();
          throw new Error("Sua sessão expirou. Entre novamente.");
        }
        throw new Error("Não foi possível renovar a sessão agora. Tente novamente.");
      }

      const dados: unknown = await resposta.json().catch(() => null);
      if (!dados || typeof dados !== "object" || !("accessToken" in dados) ||
          typeof dados.accessToken !== "string" || !dados.accessToken) {
        throw new Error("Resposta de renovação inválida. Tente novamente.");
      }

      const atual = obterSessao();
      if (!atual) throw new Error("Sessão encerrada em outra aba. Entre novamente.");
      // Outra conta pode ter feito login durante o pedido de refresh.
      if (atual.accessToken !== tokenAnterior) return atual.accessToken;
      tokenEmMemoria = dados.accessToken;
      avisarMudancaSessao();
      return dados.accessToken;
    });
  })();

  renovacaoPendente = promessa;
  try {
    return await promessa;
  } finally {
    if (renovacaoPendente === promessa) renovacaoPendente = null;
  }
}

/**
 * Ponto único para chamadas protegidas do frontend.
 * Renova antes da expiração ou após HTTP 401, tenta novamente uma vez
 * e nunca apaga a sessão por falha transitória HTTP 5xx / rede.
 */
export async function fetchAutenticado(caminho: string, opcoes: RequestInit = {}): Promise<Response> {
  const sessao = obterSessao();
  if (!sessao) throw new Error("Sua sessão terminou. Entre novamente.");

  let token = sessao.accessToken;
  if (tokenPrestesAExpirar(token)) token = await renovarTokenUmaVez(token);

  const executar = (tokenAtual: string) => {
    const headers = new Headers(opcoes.headers);
    headers.set("Authorization", `Bearer ${tokenAtual}`);
    return fetch(caminho, { ...opcoes, headers, credentials: "include" });
  };

  let resposta = await executar(token);
  if (resposta.status === 401) {
    token = await renovarTokenUmaVez(token);
    resposta = await executar(token);
  }
  return resposta;
}
