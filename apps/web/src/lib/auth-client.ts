"use client";

/**
 * Sessão da interface. Nenhum JWT ou segredo fica em localStorage, sessionStorage
 * ou em variáveis globais. A API é acessada por cookie HttpOnly via BFF/Proxy.
 */
const CHAVE_TOKEN_LEGADO = "lartop_access_token";
const CHAVE_ATIVA = "lartop_sessao_ativa";
const CHAVE_TIPO = "lartop_tipo_usuario";
const CHAVE_NOME = "lartop_nome_usuario";
const EVENTO_SESSAO = "lartop:sessao-alterada";
const BLOQUEIO_RENOVACAO = "lartop:renovacao-sessao";

// Compatibilidade interna com componentes que ainda usam o nome accessToken.
// O valor é SEMPRE um marcador estático, nunca uma credencial JWT.
const MARCADOR_SESSAO = "cookie-httponly";

export interface SessaoLocal {
  /** @deprecated Marcador de interface, não é um token. */
  accessToken: string;
  tipo: "CLIENTE" | "PROFISSIONAL" | "ADMIN";
  nome: string;
}

function apagarTokenLegado(): void {
  if (typeof window !== "undefined") localStorage.removeItem(CHAVE_TOKEN_LEGADO);
}

function notificarSessao(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_SESSAO));
}

export function observarSessao(callback: () => void): () => void {
  const aoArmazenar = (evento: StorageEvent) => {
    if (!evento.key || [CHAVE_TOKEN_LEGADO, CHAVE_ATIVA, CHAVE_TIPO, CHAVE_NOME].includes(evento.key)) {
      callback();
    }
  };
  window.addEventListener("storage", aoArmazenar);
  window.addEventListener(EVENTO_SESSAO, callback);
  return () => {
    window.removeEventListener("storage", aoArmazenar);
    window.removeEventListener(EVENTO_SESSAO, callback);
  };
}

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
    const mensagem = "erro" in dados && typeof dados.erro === "string" ? dados.erro : mensagemPadrao;
    throw new Error(`${mensagem} (HTTP ${resposta.status}).`);
  }
  return dados as T;
}

function tipoValido(tipo: unknown): tipo is SessaoLocal["tipo"] {
  return tipo === "CLIENTE" || tipo === "PROFISSIONAL" || tipo === "ADMIN";
}

/** Apenas dicas visuais NÃO confidenciais; o backend sempre verifica o acesso. */
export function obterSessao(): SessaoLocal | null {
  if (typeof window === "undefined") return null;
  apagarTokenLegado();
  if (localStorage.getItem(CHAVE_ATIVA) !== "1") return null;
  const tipo = localStorage.getItem(CHAVE_TIPO);
  const nome = localStorage.getItem(CHAVE_NOME);
  if (!tipoValido(tipo) || !nome) return null;
  return { accessToken: MARCADOR_SESSAO, tipo, nome };
}

export function salvarSessao(sessao: SessaoLocal): void {
  apagarTokenLegado();
  if (!tipoValido(sessao.tipo) || !sessao.nome) {
    throw new Error("Resposta de autenticação incompleta");
  }
  localStorage.setItem(CHAVE_TIPO, sessao.tipo);
  localStorage.setItem(CHAVE_NOME, sessao.nome);
  // Sinalizar login por último para outras abas não lerem dados incompletos.
  localStorage.setItem(CHAVE_ATIVA, "1");
  notificarSessao();
}

export function limparSessao(): void {
  apagarTokenLegado();
  localStorage.removeItem(CHAVE_ATIVA);
  localStorage.removeItem(CHAVE_TIPO);
  localStorage.removeItem(CHAVE_NOME);
  notificarSessao();
}

async function usuarioAtual(): Promise<{ nome: string; tipo: SessaoLocal["tipo"] } | null> {
  const resposta = await fetch("/api/usuarios/mim", {
    credentials: "same-origin", cache: "no-store",
  });
  if (resposta.status === 401) return null;
  const dados = await lerRespostaAutenticacao<{ nome: string; tipo: SessaoLocal["tipo"] }>(
    resposta, "Não foi possível verificar sua sessão",
  );
  if (!tipoValido(dados.tipo) || typeof dados.nome !== "string" || !dados.nome.trim()) {
    throw new Error("Dados de conta incompletos");
  }
  return { nome: dados.nome, tipo: dados.tipo };
}

/** Web Locks serializa refresh/logout entre abas do mesmo perfil Chrome/PWA. */
async function comBloqueioSessao<T>(operacao: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(BLOQUEIO_RENOVACAO, operacao);
  }
  return operacao();
}

let renovacaoPendente: Promise<void> | null = null;

async function renovarSessao(): Promise<void> {
  if (renovacaoPendente) return renovacaoPendente;
  const promessa = comBloqueioSessao(async () => {
    // Uma segunda aba pode ter acabado de renovar os cookies dentro do lock.
    // Nesse caso não consumir novamente o token refresh rotativo.
    if (await usuarioAtual()) return;
    // Nunca solicitar ou ler um JWT no JavaScript. O BFF usa o refresh
    // HttpOnly e devolve somente metadados, definindo novo access HttpOnly.
    let resposta: Response;
    try {
      resposta = await fetch("/api/auth/refresh", {
        method: "POST", credentials: "same-origin", cache: "no-store",
      });
    } catch {
      throw new Error("Sem conexão para renovar a sessão. Tente novamente.");
    }
    if (resposta.status === 401) {
      limparSessao();
      throw new Error("Sua sessão expirou. Entre novamente.");
    }
    if (!resposta.ok) {
      throw new Error("Não foi possível renovar a sessão agora. Tente novamente.");
    }
  });
  renovacaoPendente = promessa;
  try {
    await promessa;
  } finally {
    if (renovacaoPendente === promessa) renovacaoPendente = null;
  }
}

let restauracaoPendente: Promise<SessaoLocal | null> | null = null;

/** Ao atualizar o PWA, migra sessões anteriores pelo refresh HttpOnly. */
export async function restaurarSessao(): Promise<SessaoLocal | null> {
  if (restauracaoPendente) return restauracaoPendente;
  const promise = (async () => {
    apagarTokenLegado();
    let usuario = await usuarioAtual();
    if (!usuario) {
      try {
        await renovarSessao();
      } catch (e) {
        // 401 é ausência/expiração definitiva. Falha 5xx/rede deve ser
        // visível ao usuário em vez de aparentar logout.
        if (e instanceof Error &&
            (e.message.includes("expirou") || e.message.includes("Entre novamente"))) {
          return null;
        }
        throw e;
      }
      usuario = await usuarioAtual();
    }
    if (!usuario) {
      limparSessao();
      return null;
    }
    const sessao = { ...usuario, accessToken: MARCADOR_SESSAO };
    const anterior = obterSessao();
    if (!anterior || anterior.nome !== sessao.nome || anterior.tipo !== sessao.tipo) {
      salvarSessao(sessao);
    }
    return sessao;
  })();
  restauracaoPendente = promise;
  try {
    return await promise;
  } finally {
    if (restauracaoPendente === promise) restauracaoPendente = null;
  }
}

export async function entrar(email: string, senha: string): Promise<SessaoLocal> {
  const resposta = await fetch("/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    credentials: "same-origin", body: JSON.stringify({ email, senha }),
  });
  await lerRespostaAutenticacao<Record<string, unknown>>(resposta, "Não foi possível entrar");
  const usuario = await usuarioAtual();
  if (!usuario) throw new Error("O servidor não confirmou a nova sessão.");
  const sessao = { ...usuario, accessToken: MARCADOR_SESSAO };
  salvarSessao(sessao);
  return sessao;
}

export async function registrarComoCliente(input: {
  nome: string; email: string; senha: string; telefone?: string;
}): Promise<SessaoLocal> {
  const resposta = await fetch("/api/auth/registrar/cliente", {
    method: "POST", headers: { "Content-Type": "application/json" },
    credentials: "same-origin", body: JSON.stringify(input),
  });
  const dados = await lerRespostaAutenticacao<{
    usuario: { tipo: SessaoLocal["tipo"]; nome: string };
  }>(resposta, "Não foi possível cadastrar");
  if (!tipoValido(dados.usuario?.tipo) || !dados.usuario?.nome) {
    throw new Error("Resposta incompleta do servidor ao cadastrar.");
  }
  const sessao = { tipo: dados.usuario.tipo, nome: dados.usuario.nome, accessToken: MARCADOR_SESSAO };
  salvarSessao(sessao);
  return sessao;
}

export async function encerrarSessao(_accessToken?: string): Promise<void> {
  await comBloqueioSessao(async () => {
    const resposta = await fetch("/api/auth/logout", {
      method: "POST", credentials: "same-origin", cache: "no-store",
    });
    if (!resposta.ok) {
      throw new Error("O servidor não confirmou o encerramento da sessão.");
    }
    limparSessao();
  });
}

/**
 * Encaminha requests protegidas via Proxy, sem expor JWT em JS nem
 * adicionar Authorization manipulável pelo frontend.
 */
export async function fetchAutenticado(caminho: string, opcoes: RequestInit = {}): Promise<Response> {
  if (!caminho.startsWith("/api/") || caminho.startsWith("//")) {
    throw new Error("Somente APIs internas podem usar a sessão autenticada.");
  }
  if (!obterSessao()) {
    const recuperada = await restaurarSessao();
    if (!recuperada) throw new Error("Sua sessão terminou. Entre novamente.");
  }
  const executar = () => {
    const headers = new Headers(opcoes.headers);
    headers.delete("Authorization");
    return fetch(caminho, { ...opcoes, headers, credentials: "same-origin" });
  };
  let resposta = await executar();
  if (resposta.status === 401) {
    await renovarSessao();
    resposta = await executar();
    if (resposta.status === 401) {
      limparSessao();
      throw new Error("Sua sessão terminou. Entre novamente.");
    }
  }
  return resposta;
}
