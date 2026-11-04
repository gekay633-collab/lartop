"use client";

const CHAVE_TOKEN = "lartop_access_token";
const CHAVE_TIPO = "lartop_tipo_usuario";
const CHAVE_NOME = "lartop_nome_usuario";

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
  const accessToken = localStorage.getItem(CHAVE_TOKEN);
  const tipo = localStorage.getItem(CHAVE_TIPO) as SessaoLocal["tipo"] | null;
  const nome = localStorage.getItem(CHAVE_NOME);
  if (!accessToken || !tipo || !nome) return null;
  return { accessToken, tipo, nome };
}

export function salvarSessao(sessao: SessaoLocal) {
  localStorage.setItem(CHAVE_TOKEN, sessao.accessToken);
  localStorage.setItem(CHAVE_TIPO, sessao.tipo);
  localStorage.setItem(CHAVE_NOME, sessao.nome);
}

export function limparSessao() {
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_TIPO);
  localStorage.removeItem(CHAVE_NOME);
}

/**
 * Encerra a sessão primeiro no servidor (cookie refresh + access JWT) e
 * somente depois apaga o estado local. Isso evita logout falso se o Redis
 * estiver temporariamente indisponível.
 */
export async function encerrarSessao(accessToken?: string): Promise<void> {
  const resposta = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!resposta.ok) {
    throw new Error("O servidor não confirmou o encerramento da sessão.");
  }
  limparSessao();
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
